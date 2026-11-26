"""Publica a lâmina (quando a CVM traz) e a ficha cadastral de cada fundo do catálogo do Painel."""
import argparse
import concurrent.futures
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zipfile

ROOT = 'https://dados.cvm.gov.br/dados/FI/'
CADASTRO = ROOT + 'CAD/DADOS/registro_fundo_classe.zip'
EXTRATO = ROOT + 'DOC/EXTRATO/DADOS/extrato_fi_{ano}.csv'
LAMINA = ROOT + 'DOC/LAMINA/DADOS/lamina_fi_{competencia}.zip'
BUCKETS = 128  # O mesmo espalhamento das cotas: o navegador baixa só o arquivo do fundo aberto.
MESES_LAMINA = 13
TEXTO_MAX = 1200


def baixar(url):
    for tentativa in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Painel-Especialista/1.0'}), timeout=60) as r:
                return r.read(256 * 1024 * 1024 + 1)
        except HTTPError as exc:
            if exc.code == 404 or tentativa == 2:
                raise
        except OSError:
            if tentativa == 2:
                raise
        time.sleep(2 ** tentativa)


def cnpj(texto):
    return re.sub(r'[./\s-]', '', texto or '').upper()


def bucket(documento):
    valor = 0
    for char in documento:
        valor = (valor * 31 + ord(char)) % BUCKETS
    return valor


def linhas(conteudo):
    return csv.DictReader(io.StringIO(conteudo.decode('latin1')), delimiter=';')


def numero(texto):
    try:
        valor = float((texto or '').strip())
    except ValueError:
        return None
    return valor if valor == valor and abs(valor) < 1e15 else None


def inteiro(texto):
    valor = numero(texto)
    return None if valor is None else int(valor)


def texto(valor, limite=TEXTO_MAX):
    valor = re.sub(r'\s+', ' ', valor or '').strip()
    if valor in ('', '-', 'N/A'):
        return None
    return valor if len(valor) <= limite else valor[:limite].rsplit(' ', 1)[0] + '…'


def sim(valor):
    return {'S': True, 'N': False}.get((valor or '').strip())


def data(valor):
    valor = (valor or '').strip()[:10]
    return valor if re.fullmatch(r'\d{4}-\d{2}-\d{2}', valor) else None


def limpo(objeto):
    return {chave: valor for chave, valor in objeto.items() if valor not in (None, '', [], {})}


def ler_cadastro(conteudo):
    zipado = zipfile.ZipFile(io.BytesIO(conteudo))
    fundos, classes = {}, {}
    for r in linhas(zipado.read('registro_fundo.csv')):
        fundos[cnpj(r['CNPJ_Fundo'])] = limpo({
            'codigo': texto(r.get('Codigo_CVM')), 'tipo': texto(r.get('Tipo_Fundo')),
            'situacao': texto(r.get('Situacao')), 'inicio': data(r.get('Data_Registro')),
            'pl': numero(r.get('Patrimonio_Liquido')), 'dataPl': data(r.get('Data_Patrimonio_Liquido'))})
    for r in linhas(zipado.read('registro_classe.csv')):
        classes[cnpj(r['CNPJ_Classe'])] = limpo({
            'codigo': texto(r.get('Codigo_CVM')), 'tipo': texto(r.get('Classificacao')),
            'anbima': texto(r.get('Classificacao_Anbima')), 'publico': texto(r.get('Publico_Alvo')),
            'exclusivo': sim(r.get('Exclusivo')), 'longoPrazo': sim(r.get('Tributacao_Longo_Prazo')),
            'indicador': texto(r.get('Indicador_Desempenho')), 'condominio': texto(r.get('Forma_Condominio')),
            'situacao': texto(r.get('Situacao')), 'inicio': data(r.get('Data_Inicio')),
            'pl': numero(r.get('Patrimonio_Liquido')), 'dataPl': data(r.get('Data_Patrimonio_Liquido'))})
    return fundos, classes


def ler_extratos(arquivos):
    extratos = {}
    for conteudo in arquivos:
        for r in linhas(conteudo):
            documento, competencia = cnpj(r.get('CNPJ_FUNDO_CLASSE')), data(r.get('DT_COMPTC'))
            if not competencia or competencia <= extratos.get(documento, {}).get('data', ''):
                continue
            extratos[documento] = limpo({
                'data': competencia, 'aplicMin': numero(r.get('APLIC_MIN')),
                'conversao': inteiro(r.get('QT_DIA_CONVERSAO_COTA')), 'pagamento': inteiro(r.get('QT_DIA_PAGTO_RESGATE')),
                'tipoPagamento': texto(r.get('TP_DIA_PAGTO_RESGATE')), 'taxaAdm': numero(r.get('TAXA_ADM')),
                'performance': sim(r.get('EXISTE_TAXA_PERFM')), 'taxaPerf': numero(r.get('TAXA_PERFM')),
                'entrada': sim(r.get('EXISTE_TAXA_INGRESSO')), 'saida': sim(r.get('EXISTE_TAXA_SAIDA')),
                'exterior': sim(r.get('INVEST_EXTERIOR')), 'credito': sim(r.get('ATIVO_CRED_PRIV')),
                'politica': texto(r.get('POLIT_INVEST'), 600)})
    return extratos


def mes_rentabilidade(mes, competencia):
    ano, atual = int(competencia[:4]), int(competencia[5:7])
    return f'{ano if mes <= atual else ano - 1:04d}-{mes:02d}'


def ler_laminas(zips):
    """Fica a lâmina mais recente de cada CNPJ; a da classe vale mais que a de uma subclasse."""
    escolhidas, partes = {}, {}
    for conteudo in zips:
        zipado = zipfile.ZipFile(io.BytesIO(conteudo))
        for nome in zipado.namelist():
            tipo = ('carteira' if '_carteira_' in nome else 'anos' if '_rentab_ano_' in nome
                    else 'meses' if '_rentab_mes_' in nome else 'lamina')
            for r in linhas(zipado.read(nome)):
                chave = (cnpj(r.get('CNPJ_FUNDO_CLASSE')), (r.get('ID_SUBCLASSE') or '').strip(), data(r.get('DT_COMPTC')))
                if not chave[2]:
                    continue
                if tipo == 'lamina':
                    atual = escolhidas.get(chave[0])
                    if atual is None or (chave[2], not chave[1]) > (atual[2], not atual[1]):
                        escolhidas[chave[0]] = chave
                    partes.setdefault(chave, {})['lamina'] = r
                else:
                    partes.setdefault(chave, {}).setdefault(tipo, []).append(r)
    laminas = {}
    for documento, chave in escolhidas.items():
        p, competencia = partes[chave], chave[2]
        r = p['lamina']
        anos = sorted(([inteiro(x.get('ANO_RENTAB')), numero(x.get('PR_RENTAB_ANO')),
                        numero(x.get('PR_VARIACAO_INDICE_REFER_ANO')), numero(x.get('PR_PERFM_INDICE_REFER_ANO'))]
                       for x in p.get('anos', []) if inteiro(x.get('ANO_RENTAB'))), key=lambda x: x[0])[-10:]
        meses = sorted(([mes_rentabilidade(inteiro(x.get('MES_RENTAB')), competencia), numero(x.get('PR_RENTAB_MES')),
                         numero(x.get('PR_VARIACAO_INDICE_REFER_MES'))]
                        for x in p.get('meses', []) if 1 <= (inteiro(x.get('MES_RENTAB')) or 0) <= 12), key=lambda x: x[0])[-12:]
        carteira = sorted(([texto(x.get('TP_ATIVO'), 120), numero(x.get('PR_PL_ATIVO'))] for x in p.get('carteira', [])
                           if texto(x.get('TP_ATIVO')) and numero(x.get('PR_PL_ATIVO')) is not None), key=lambda x: -abs(x[1]))[:12]
        laminas[documento] = limpo({
            'data': competencia, 'subclasse': chave[1] or None, 'nome': texto(r.get('NM_FANTASIA') or r.get('DENOM_SOCIAL'), 200),
            'objetivo': texto(r.get('OBJETIVO')), 'publico': texto(r.get('PUBLICO_ALVO')), 'restricao': texto(r.get('RESTR_INVEST')),
            'politica': texto(r.get('POLIT_INVEST')), 'exterior': numero(r.get('PR_PL_ATIVO_EXTERIOR')),
            'credito': numero(r.get('PR_PL_ATIVO_CRED_PRIV')), 'alavancagem': numero(r.get('PR_PL_ALAVANC')),
            'perdaAlemDoAplicado': sim(r.get('RISCO_PERDA_NEGATIVO')), 'aplicInicial': numero(r.get('INVEST_INICIAL_MIN')),
            'aplicAdicional': numero(r.get('INVEST_ADIC')), 'resgateMin': numero(r.get('RESGATE_MIN')),
            'horario': texto(r.get('HORA_APLIC_RESGATE'), 20), 'carencia': inteiro(r.get('QT_DIA_CAREN')),
            'cotaAplicacao': inteiro(r.get('QT_DIA_CONVERSAO_COTA_COMPRA')), 'cotaResgate': inteiro(r.get('QT_DIA_CONVERSAO_COTA_RESGATE')),
            'pagamento': inteiro(r.get('QT_DIA_PAGTO_RESGATE')), 'tipoPagamento': texto(r.get('TP_DIA_PAGTO_RESGATE'), 40),
            'taxaAdm': numero(r.get('TAXA_ADM')), 'taxaAdmMax': numero(r.get('TAXA_ADM_MAX')),
            'taxaAdmObs': texto(r.get('TAXA_ADM_OBS'), 300), 'taxaEntrada': numero(r.get('TAXA_ENTR')),
            'taxaSaida': numero(r.get('TAXA_SAIDA')), 'taxaPerf': texto(r.get('TAXA_PERFM'), 300),
            'despesas': numero(r.get('PR_PL_DESPESA')), 'pl': numero(r.get('VL_PATRIM_LIQ')),
            'risco': inteiro(r.get('CLASSE_RISCO_ADMIN')), 'indice': texto(r.get('INDICE_REFER'), 80),
            'rentab5': numero(r.get('PR_RENTAB_FUNDO_5ANO')), 'indice5': numero(r.get('PR_VARIACAO_INDICE_REFER_5ANO')),
            'anosPerda': inteiro(r.get('QT_ANO_PERDA')), 'anos': anos, 'meses': meses, 'carteira': carteira})
    return laminas


def competencias(hoje, quantidade):
    for anterior in range(quantidade):
        ano, indice = divmod(hoje.year * 12 + hoje.month - 1 - anterior, 12)
        yield f'{ano:04d}{indice + 1:02d}'


def coletar(pasta, hoje, documentos, ler=baixar):
    fundos, classes = ler_cadastro(ler(CADASTRO))
    extratos_brutos = []
    for ano in (hoje.year, hoje.year - 1):
        try:
            extratos_brutos.append(ler(EXTRATO.format(ano=ano)))
        except HTTPError as exc:
            if exc.code != 404:
                raise
    zips = []
    for competencia in competencias(hoje, MESES_LAMINA + 1):
        try:
            zips.append(ler(LAMINA.format(competencia=competencia)))
        except HTTPError as exc:
            if exc.code != 404:
                raise
        if len(zips) == MESES_LAMINA:
            break
    if not zips or not classes:
        raise ValueError('A CVM não trouxe cadastro ou lâminas.')
    extratos, laminas = ler_extratos(extratos_brutos), ler_laminas(zips)
    grupos = [{} for _ in range(BUCKETS)]
    contagem = {'fichas': 0, 'laminas': 0, 'extratos': 0}
    for documento in sorted(documentos):
        ficha = limpo({'cadastro': classes.get(documento) or fundos.get(documento),
                       'extrato': extratos.get(documento), 'lamina': laminas.get(documento)})
        if not ficha:
            continue
        grupos[bucket(documento)][documento] = ficha
        contagem['fichas'] += 1
        contagem['laminas'] += 'lamina' in ficha
        contagem['extratos'] += 'extrato' in ficha
    if not contagem['fichas']:
        raise ValueError('Nenhum fundo do catálogo tem ficha na CVM.')
    arquivos = {str(numero_grupo): gravar(pasta, f'fichas-{numero_grupo}', grupo) for numero_grupo, grupo in enumerate(grupos)}
    manifest = {'version': 1, 'collected': hoje.isoformat(), **contagem, 'files': arquivos}
    (pasta / 'manifest.json').write_text(json.dumps(manifest), encoding='utf8')
    print(f'CVM: {contagem["fichas"]} fichas, {contagem["laminas"]} com lâmina e {contagem["extratos"]} com extrato.')


def gravar(pasta, arquivo, objeto):
    conteudo = gzip.compress(json.dumps(objeto, separators=(',', ':'), ensure_ascii=False).encode(), mtime=0)
    nome = f'{arquivo}-{hashlib.sha256(conteudo).hexdigest()}.json.gz'
    (pasta / nome).write_bytes(conteudo)
    return nome


def manifest_validado(conteudo):
    manifest = json.loads(conteudo)
    arquivos = manifest['files']
    if (manifest['version'] != 1 or set(arquivos) != {str(i) for i in range(BUCKETS)}
            or any(not re.fullmatch(f'fichas-{chave}-[a-f0-9]{{64}}\\.json\\.gz', arquivo) for chave, arquivo in arquivos.items())):
        raise ValueError('Manifesto das fichas da CVM inválido.')
    return manifest


def documentos_do_catalogo(pasta_cvm):
    manifest = json.loads((pasta_cvm / 'manifest.json').read_bytes())
    catalogo = json.loads(gzip.decompress((pasta_cvm / manifest['files']['catalogo']).read_bytes()))
    return {item[2] for item in catalogo}


def restaurar(pasta, origem):
    try:
        conteudo = baixar(origem + '/cvm/fichas/manifest.json')
    except HTTPError as exc:
        if exc.code == 404:
            return False
        raise
    manifest = manifest_validado(conteudo)

    def copiar(arquivo):
        dados = baixar(origem + '/cvm/fichas/' + arquivo)
        if hashlib.sha256(dados).hexdigest() != arquivo.split('-')[-1].split('.')[0]:
            raise ValueError(f'Ficha publicada diverge do manifesto: {arquivo}')
        (pasta / arquivo).write_bytes(dados)

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        list(executor.map(copiar, manifest['files'].values()))
    (pasta / 'manifest.json').write_bytes(conteudo)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destino', type=Path)
    parser.add_argument('--catalogo', type=Path, required=True, help='Pasta da base de cotas já preparada (dist/cvm).')
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--origem', required=True)
    parser.add_argument('--hoje', type=dt.date.fromisoformat, required=True)
    parser.add_argument('--atualizar', action='store_true')
    args = parser.parse_args()
    manifest = args.cache / 'manifest.json'
    with tempfile.TemporaryDirectory() as temporario:
        pasta = Path(temporario)
        if not manifest.is_file():
            try:
                if restaurar(pasta, args.origem):
                    shutil.copytree(pasta, args.cache, dirs_exist_ok=True)
            except (OSError, ValueError, KeyError) as exc:
                print(f'::warning::Não foi possível recuperar as fichas publicadas. Motivo: {exc}')
        anterior = manifest_validado(manifest.read_bytes()) if manifest.is_file() else None
        if anterior is None or (args.atualizar and anterior['collected'] != args.hoje.isoformat()):
            nova = pasta / 'nova'
            nova.mkdir()
            try:
                coletar(nova, args.hoje, documentos_do_catalogo(args.catalogo))
                manifest_validado((nova / 'manifest.json').read_bytes())
            except (OSError, ValueError, KeyError, csv.Error, zipfile.BadZipFile) as exc:
                # A lâmina é complemento: sem ela o site sai do mesmo jeito e a tela avisa que a ficha não carregou.
                origem = f'Preservando as fichas de {anterior["collected"]}' if anterior else 'Publicando sem fichas'
                print(f'::warning::Fichas da CVM indisponíveis. {origem}. Motivo: {exc}')
            else:
                args.cache.mkdir(parents=True, exist_ok=True)
                if anterior:
                    for arquivo in anterior['files'].values():
                        (args.cache / arquivo).unlink(missing_ok=True)
                for arquivo in nova.iterdir():
                    shutil.copyfile(arquivo, args.cache / arquivo.name)
        if not manifest.is_file():
            return
        atual = manifest_validado(manifest.read_bytes())
        args.destino.mkdir(parents=True, exist_ok=True)
        for arquivo in atual['files'].values():
            dado = (args.cache / arquivo).read_bytes()
            if hashlib.sha256(dado).hexdigest() != arquivo.split('-')[-1].split('.')[0]:
                raise ValueError(f'Ficha da CVM diverge do manifesto: {arquivo}')
            (args.destino / arquivo).write_bytes(dado)
            # Cópia em JSON comum: redes de empresa que barram download de .gz ainda leem a ficha.
            (args.destino / arquivo.removesuffix('.gz')).write_bytes(gzip.decompress(dado))
        shutil.copyfile(manifest, args.destino / manifest.name)


if __name__ == '__main__':
    main()
