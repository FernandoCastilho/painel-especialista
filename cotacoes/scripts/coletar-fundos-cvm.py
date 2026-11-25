"""Publica cotas diárias e cadastro pesquisável da CVM no pacote de Pages."""
import argparse
import concurrent.futures
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import zipfile

ROOT = 'https://dados.cvm.gov.br/dados/FI/'
INFORMES = ROOT + 'DOC/INF_DIARIO/DADOS/'
CADASTRO = ROOT + 'CAD/DADOS/registro_fundo_classe.zip'
CADASTRO_LEGADO = ROOT + 'CAD/DADOS/cad_fi.csv'
CNPJ = re.compile(r'[A-Z0-9]{12}\d{2}', re.ASCII)
SUB = re.compile(r'[A-Za-z0-9_-]{1,64}')
TIPOS_FUNDO = {'FI', 'FIF', 'FACFIF', 'FAPI', 'FMP-FGTS', 'FMP-FGTS CL'}
BUCKETS = 128
MONTHS = 14  # Mês corrente e treze fechados, para até doze retornos mensais completos.


def baixar(url):
    for tentativa in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Painel-Especialista/1.0'}), timeout=30) as r:
                return r.read(64 * 1024 * 1024 + 1)
        except HTTPError as exc:
            if exc.code == 404 or tentativa == 2:
                raise
        except OSError:
            if tentativa == 2:
                raise
        time.sleep(2 ** tentativa)


def cnpj(texto):
    return re.sub(r'[./\s-]', '', texto).upper()


def mes(data, anterior):
    ano, indice = divmod(data.year * 12 + data.month - 1 - anterior, 12)
    return f'{ano:04d}-{indice + 1:02d}'


def leitor(zipado, arquivo):
    return csv.DictReader(io.TextIOWrapper(zipado.open(arquivo), encoding='latin1', newline=''), delimiter=';')


def registros(reader, colunas, fonte):
    if not colunas.issubset(reader.fieldnames or ()):
        raise ValueError(f'Colunas inesperadas em {fonte}.')
    for linha in reader:
        if any(linha[coluna] is None for coluna in colunas):
            raise ValueError(f'Linha incompleta em {fonte}.')
        yield linha


def tipo_serie(moderno, tipo, sub):
    # O cabeçalho CNPJ_FUNDO_CLASSE também é usado pelos fundos do cadastro anterior.
    if moderno and (sub or tipo.startswith(('CLASSE ', 'CLASSES '))):
        return 'c'
    if not moderno or tipo in TIPOS_FUNDO:
        return 'f'
    return None


def juntar_informe(conteudo, competencia, series, conflitos, tipos_desconhecidos):
    if len(conteudo) > 64 * 1024 * 1024:
        raise ValueError('Informe diário acima do tamanho previsto.')
    arquivo = 'inf_diario_fi_' + competencia.replace('-', '') + '.csv'
    with zipfile.ZipFile(io.BytesIO(conteudo)) as zipado:
        reader = leitor(zipado, arquivo)
        moderno = 'CNPJ_FUNDO_CLASSE' in (reader.fieldnames or ())
        coluna = 'CNPJ_FUNDO_CLASSE' if moderno else 'CNPJ_FUNDO'
        exigidas = {coluna, 'DT_COMPTC', 'VL_QUOTA'}
        if moderno:
            exigidas.update(('ID_SUBCLASSE', 'TP_FUNDO_CLASSE'))
        validas = 0
        for linha in registros(reader, exigidas, arquivo):
            documento = cnpj(linha[coluna])
            sub = linha.get('ID_SUBCLASSE', '').strip()
            if not CNPJ.fullmatch(documento) or (sub and not SUB.fullmatch(sub)):
                continue
            tipo = linha.get('TP_FUNDO_CLASSE', '').strip()
            categoria = tipo_serie(moderno, tipo, sub)
            if categoria is None:
                tipos_desconhecidos.add(tipo)
                continue
            dia, texto = linha['DT_COMPTC'], linha['VL_QUOTA']
            try:
                if not dia.startswith(competencia + '-') or dia != dt.date.fromisoformat(dia).isoformat():
                    continue
                cota = float(texto.replace(',', '.'))
            except ValueError:
                continue
            if not math.isfinite(cota) or not 1e-12 <= cota <= 1e12:
                continue
            id_serie = f'cvm-{categoria}-{documento}' + ('-' + sub if sub else '')
            dias = series.setdefault(id_serie, {})
            if dia in dias and dias[dia] != cota:
                conflitos.add(id_serie)
            dias[sys.intern(dia)] = cota
            validas += 1
        if not validas:
            raise ValueError(f'Informe {competencia} sem cotas válidas.')


def cadastro(conteudo, legado):
    with zipfile.ZipFile(io.BytesIO(conteudo)) as zipado:
        fundos = {r['ID_Registro_Fundo']: (r['Denominacao_Social'], cnpj(r['CNPJ_Fundo']))
                  for r in registros(leitor(zipado, 'registro_fundo.csv'),
                                     {'ID_Registro_Fundo', 'Denominacao_Social', 'CNPJ_Fundo'}, 'cadastro de fundos')}
        classes = {cnpj(r['CNPJ_Classe']): (r['ID_Registro_Classe'], r['Denominacao_Social'],
                                           fundos.get(r['ID_Registro_Fundo'], ('', '')))
                   for r in registros(leitor(zipado, 'registro_classe.csv'),
                                      {'CNPJ_Classe', 'ID_Registro_Classe', 'Denominacao_Social', 'ID_Registro_Fundo'},
                                      'cadastro de classes')}
        subclasses = {(r['ID_Registro_Classe'], r['ID_Subclasse']): r['Denominacao_Social']
                      for r in registros(leitor(zipado, 'registro_subclasse.csv'),
                                         {'ID_Registro_Classe', 'ID_Subclasse', 'Denominacao_Social'},
                                         'cadastro de subclasses')}
    reader = csv.DictReader(io.StringIO(legado.decode('latin1')), delimiter=';')
    nomes_legados = {cnpj(r['CNPJ_FUNDO']): r['DENOM_SOCIAL'].strip()
                     for r in registros(reader, {'CNPJ_FUNDO', 'DENOM_SOCIAL'}, 'cadastro anterior')
                     if r['DENOM_SOCIAL'].strip()}
    if not fundos or not classes:
        raise ValueError('Cadastro de fundos ou classes vazio.')
    nomes_fundos = {documento: nome.strip() for nome, documento in fundos.values() if nome.strip()}
    return nomes_fundos, nomes_legados, classes, subclasses


def identidade(id_serie, nomes):
    fundos, legados, classes, subclasses = nomes
    partes = id_serie.split('-', 3)
    tipo, documento = partes[1:3]
    if tipo == 'f':
        nome = legados.get(documento) or fundos.get(documento) or 'Nome do fundo não identificado'
        return [id_serie, nome, documento]
    registro, classe, (pai, cnpj_pai) = classes.get(documento, ('', '', ('', '')))
    nome = classe.strip() or pai.strip() or fundos.get(documento) or legados.get(documento)
    if len(partes) == 4:
        sub = subclasses.get((registro, partes[3]), '').strip()
        if sub and sub != nome:
            nome = ' · '.join(filter(None, (nome, sub)))
    return [id_serie, nome or 'Nome da classe não identificado', documento, pai.strip(), cnpj_pai]


def bucket(documento):
    valor = 0
    for char in documento:
        valor = (valor * 31 + ord(char)) % BUCKETS
    return valor


def gravar(pasta, arquivo, objeto):
    conteudo = gzip.compress(json.dumps(objeto, separators=(',', ':'), ensure_ascii=False).encode(), mtime=0)
    nome = f'{arquivo}-{hashlib.sha256(conteudo).hexdigest()}.json.gz'
    (pasta / nome).write_bytes(conteudo)
    return nome


def coletar(pasta, hoje, ler=baixar):
    series, conflitos, tipos_desconhecidos = {}, set(), set()
    for anterior in reversed(range(MONTHS)):
        competencia = mes(hoje, anterior)
        try:
            dados = ler(INFORMES + 'inf_diario_fi_' + competencia.replace('-', '') + '.zip')
        except HTTPError as exc:
            # Na virada do mês o arquivo corrente pode ainda não existir.
            if exc.code == 404 and anterior == 0:
                continue
            raise
        juntar_informe(dados, competencia, series, conflitos, tipos_desconhecidos)
    nomes = cadastro(ler(CADASTRO), ler(CADASTRO_LEGADO))
    catalogo, grupos = [], [{} for _ in range(BUCKETS)]
    primeira, ultima = hoje.isoformat(), ''
    for id_serie, dias in sorted(series.items()):
        if id_serie in conflitos or len(dias) < 2:
            continue
        item = identidade(id_serie, nomes)
        catalogo.append(item)
        pontos = sorted(dias.items())
        grupos[bucket(item[2])][id_serie] = pontos
        primeira = min(primeira, pontos[0][0])
        ultima = max(ultima, pontos[-1][0])
    if not catalogo or not primeira <= ultima <= hoje.isoformat():
        raise ValueError('A cobertura de cotas da CVM não passou na validação.')
    catalogo.sort(key=lambda item: (item[1].casefold(), item[0]))
    arquivos = {'catalogo': gravar(pasta, 'catalogo', catalogo)}
    for numero, grupo in enumerate(grupos):
        arquivos[str(numero)] = gravar(pasta, f'cotas-{numero}', grupo)
    manifest = {'version': 1, 'collected': hoje.isoformat(), 'first': primeira, 'last': ultima,
                'funds': len(catalogo), 'files': arquivos}
    (pasta / 'manifest.json').write_text(json.dumps(manifest), encoding='utf8')
    print(f'CVM: {len(catalogo)} séries de {primeira} a {ultima}; {len(conflitos)} séries com cotas conflitantes omitidas.')
    if tipos_desconhecidos:
        print(f'::warning::Informe Diário da CVM tem tipos não identificados e omitidos: {sorted(tipos_desconhecidos)!r}')


def manifest_validado(conteudo):
    manifest = json.loads(conteudo)
    arquivos = manifest['files']
    prefixos = {'catalogo': 'catalogo', **{str(i): f'cotas-{i}' for i in range(BUCKETS)}}
    if (manifest['version'] != 1 or set(arquivos) != set(prefixos)
            or any(not re.fullmatch(prefixos[chave] + r'-[a-f0-9]{64}\.json\.gz', arquivo)
                   for chave, arquivo in arquivos.items())):
        raise ValueError('Manifesto da CVM inválido.')
    return manifest


def restaurar(pasta, origem):
    try:
        conteudo = baixar(origem + '/cvm/manifest.json')
    except HTTPError as exc:
        if exc.code == 404:
            return False
        raise
    manifest = manifest_validado(conteudo)

    def copiar(arquivo):
        dados = baixar(origem + '/cvm/' + arquivo)
        if hashlib.sha256(dados).hexdigest() != arquivo.split('-')[-1].split('.')[0]:
            raise ValueError(f'Arquivo publicado da CVM diverge do manifesto: {arquivo}')
        (pasta / arquivo).write_bytes(dados)

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        list(executor.map(copiar, manifest['files'].values()))
    (pasta / 'manifest.json').write_bytes(conteudo)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destino', type=Path)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--origem', required=True)
    parser.add_argument('--hoje', type=dt.date.fromisoformat, required=True)
    parser.add_argument('--atualizar', action='store_true')
    args = parser.parse_args()
    manifest = args.cache / 'manifest.json'
    with tempfile.TemporaryDirectory() as temporario:
        pasta = Path(temporario)
        if not manifest.is_file() and restaurar(pasta, args.origem):
            shutil.copytree(pasta, args.cache, dirs_exist_ok=True)
        anterior = manifest_validado(manifest.read_bytes()) if manifest.is_file() else None
        if anterior is None or (args.atualizar and anterior['collected'] != args.hoje.isoformat()):
            nova = pasta / 'nova'
            nova.mkdir()
            try:
                coletar(nova, args.hoje)
                nova_base = manifest_validado((nova / 'manifest.json').read_bytes())
                if anterior and nova_base['last'] < anterior['last']:
                    raise ValueError('A última cota disponível recuou na CVM.')
            except (OSError, ValueError, KeyError, csv.Error, zipfile.BadZipFile) as exc:
                if anterior is None:
                    raise
                print(f'::warning::CVM indisponível. Preservando as cotas de {anterior["collected"]}. Motivo: {exc}')
            else:
                args.cache.mkdir(parents=True, exist_ok=True)
                if anterior:
                    for arquivo in anterior['files'].values():
                        (args.cache / arquivo).unlink(missing_ok=True)
                for arquivo in nova.iterdir():
                    shutil.copyfile(arquivo, args.cache / arquivo.name)
        atual = manifest_validado(manifest.read_bytes())
        args.destino.mkdir(parents=True, exist_ok=True)
        for arquivo in atual['files'].values():
            dado = (args.cache / arquivo).read_bytes()
            if hashlib.sha256(dado).hexdigest() != arquivo.split('-')[-1].split('.')[0]:
                raise ValueError(f'Arquivo da CVM diverge do manifesto: {arquivo}')
            (args.destino / arquivo).write_bytes(dado)
            # Cópia em JSON comum: redes de empresa que barram download de .gz ainda leem a base.
            (args.destino / arquivo.removesuffix('.gz')).write_bytes(gzip.decompress(dado))
        shutil.copyfile(manifest, args.destino / manifest.name)


if __name__ == '__main__':
    main()
