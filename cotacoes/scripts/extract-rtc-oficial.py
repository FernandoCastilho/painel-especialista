#!/usr/bin/env python3
"""Extrai da calculadora oficial da Receita (regime regular) as alíquotas de referência
e os percentuais de redução, gravando um JSON estático para o painel.

Uso: python3 -I scripts/extract-rtc-oficial.py <pasta do clone oficial> <saida.json>

Os arquivos SQL oficiais são lidos como TEXTO. Nada do repositório oficial é executado:
este leitor entende só INSERT/UPDATE/DELETE simples das quatro tabelas usadas e para com
erro em qualquer forma que não reconheça, em vez de adivinhar.
"""
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

TABELAS = {'CLASSIFICACAO_TRIBUTARIA': 'CLTR_ID', 'PERCENTUAL_REDUCAO': 'PERE_ID',
           'SITUACAO_TRIBUTARIA': 'SITR_ID', 'ALIQUOTA_REFERENCIA': 'ALRE_ID'}
# Colunas cujo valor entra no JSON. Mudanças em outras colunas não alteram o resultado.
USADAS = {'CLTR_CD', 'CLTR_DESCRICAO', 'CLTR_SITR_ID', 'CLTR_TIPO_ALIQUOTA', 'CLTR_INICIO_VIGENCIA',
          'CLTR_FIM_VIGENCIA', 'PERE_CLTR_ID', 'PERE_TBTO_ID', 'PERE_VALOR', 'PERE_INICIO_VIGENCIA',
          'PERE_FIM_VIGENCIA', 'SITR_CD', 'SITR_DESCRICAO', 'SITR_INICIO_VIGENCIA', 'SITR_FIM_VIGENCIA',
          'ALRE_VALOR', 'ALRE_TBTO_ID', 'ALRE_INICIO_VIGENCIA', 'ALRE_FIM_VIGENCIA'}
TRIBUTOS = {2: 'cbs', 3: 'ibsUf', 4: 'ibsMun'}


def statements(texto):
    """Divide o SQL em comandos, ignorando comentários e ';' dentro de textos."""
    out, atual, i, n = [], [], 0, len(texto)
    while i < n:
        c = texto[i]
        if c == "'":
            j = i + 1
            while j < n:
                if texto[j] == "'" and j + 1 < n and texto[j + 1] == "'":
                    j += 2
                elif texto[j] == "'":
                    break
                else:
                    j += 1
            atual.append(texto[i:j + 1]); i = j + 1
        elif texto.startswith('--', i):
            fim = texto.find('\n', i); i = n if fim < 0 else fim
        elif texto.startswith('/*', i):
            fim = texto.find('*/', i); i = n if fim < 0 else fim + 2
        elif c == ';':
            out.append(' '.join(''.join(atual).split())); atual = []; i += 1
        else:
            atual.append(c); i += 1
    resto = ' '.join(''.join(atual).split())
    if resto:
        out.append(resto)
    return out


TOKEN = re.compile(r"\s*(?:('(?:[^']|'')*')|(NULL)\b|(-?\d+(?:\.\d+)?)|(datetime\('[^']*'\))|(,)|(\()|(\)))", re.I)


def valores(s):
    """Lê '(a, b), (c, d)' em listas de valores Python."""
    linhas, linha, prof, pos = [], None, 0, 0
    while pos < len(s):
        m = TOKEN.match(s, pos)
        if not m:
            if s[pos:].strip() == '':
                break
            raise ValueError(f'valor não reconhecido: {s[pos:pos + 60]!r}')
        pos = m.end()
        texto, nulo, num, dt, virgula, abre, fecha = m.groups()
        if abre:
            prof += 1; linha = []
        elif fecha:
            prof -= 1; linhas.append(linha)
        elif virgula:
            continue
        elif texto is not None:
            linha.append(texto[1:-1].replace("''", "'"))
        elif nulo:
            linha.append(None)
        elif num is not None:
            linha.append(float(num) if '.' in num else int(num))
        elif dt:
            linha.append(dt[10:-2])
    return linhas


def valor_simples(s):
    linha = valores(f'({s})')
    if len(linha) != 1 or len(linha[0]) != 1:
        raise ValueError(f'valor não reconhecido: {s!r}')
    return linha[0][0]


def condicao(where, tabela):
    """Devolve uma função que testa a linha, para as formas usadas nos arquivos oficiais."""
    w = where.strip()
    m = re.fullmatch(r'(\w+)\s*=\s*(\S+)', w)
    if m:
        col, v = m.group(1), valor_simples(m.group(2))
        return lambda r: r.get(col) == v
    m = re.fullmatch(r'(\w+)\s+IN\s*\(([^()]*)\)', w, re.I)
    if m:
        col, vs = m.group(1), set(valores(f'({m.group(2)})')[0])
        return lambda r: r.get(col) in vs
    m = re.fullmatch(r"ALRE_TBTO_ID IN \(([^()]*)\) AND ALRE_INICIO_VIGENCIA > '([\d-]+)'", w, re.I)
    if m:
        vs, d = set(valores(f'({m.group(1)})')[0]), m.group(2)
        return lambda r: r['ALRE_TBTO_ID'] in vs and r['ALRE_INICIO_VIGENCIA'] > d
    m = re.fullmatch(r"ALRE_INICIO_VIGENCIA <= '([\d-]+)' and ALRE_TBTO_ID IN \(([^()]*)\)", w, re.I)
    if m:
        d, vs = m.group(1), set(valores(f'({m.group(2)})')[0])
        return lambda r: r['ALRE_INICIO_VIGENCIA'] <= d and r['ALRE_TBTO_ID'] in vs
    return None


def separar_set(s):
    partes, prof, atual, aspas = [], 0, '', False
    for c in s:
        if c == "'":
            aspas = not aspas
        if not aspas and c == '(':
            prof += 1
        if not aspas and c == ')':
            prof -= 1
        if c == ',' and prof == 0 and not aspas:
            partes.append(atual); atual = ''
        else:
            atual += c
    partes.append(atual)
    return [tuple(x.strip() for x in p.split('=', 1)) for p in partes]


def aplicar(st, db, origem):
    m = re.match(r'INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*(.*)$', st, re.I | re.S)
    if m and m.group(1).upper() in TABELAS:
        tab = m.group(1).upper(); cols = [c.strip().upper() for c in m.group(2).split(',')]
        for linha in valores(m.group(3)):
            if len(linha) != len(cols):
                raise ValueError(f'{origem}: colunas e valores não batem em {tab}')
            reg = dict(zip(cols, linha)); chave = reg.get(TABELAS[tab])
            if chave is None:
                raise ValueError(f'{origem}: INSERT sem identificador em {tab}')
            if chave in db[tab]:
                raise ValueError(f'{origem}: identificador repetido {chave} em {tab}')
            reg['_origem'] = origem
            db[tab][chave] = reg
        return
    m = re.match(r'UPDATE (\w+) SET (.*?)(?: WHERE (.*))?$', st, re.I | re.S)
    if m and m.group(1).upper() in TABELAS:
        tab = m.group(1).upper(); sets = separar_set(m.group(2))
        if not any(col.upper() in USADAS for col, _ in sets):
            return  # muda só colunas que não usamos (ex.: indicadores de grupo da nota)
        teste = condicao(m.group(3) or '', tab)
        if teste is None:
            raise ValueError(f'{origem}: UPDATE não reconhecido: {st[:160]}')
        for reg in db[tab].values():
            if teste(reg):
                for col, v in sets:
                    reg[col.upper()] = valor_simples(v)
                reg['_origem'] = origem
        return
    m = re.match(r'DELETE FROM (\w+) WHERE (.*)$', st, re.I | re.S)
    if m and m.group(1).upper() in TABELAS:
        tab = m.group(1).upper(); teste = condicao(m.group(2), tab)
        if teste is None:
            raise ValueError(f'{origem}: DELETE não reconhecido: {st[:160]}')
        for chave in [k for k, r in db[tab].items() if teste(r)]:
            del db[tab][chave]
        return
    for tab in TABELAS:
        if re.match(rf'(INSERT(?: OR \w+)? INTO|REPLACE INTO|UPDATE|DELETE FROM)\s+{tab}\b', st, re.I):
            raise ValueError(f'{origem}: comando não reconhecido em {tab}: {st[:160]}')


def vigente(reg, prefixo, dia):
    return reg[f'{prefixo}_INICIO_VIGENCIA'] <= dia and (reg[f'{prefixo}_FIM_VIGENCIA'] is None or reg[f'{prefixo}_FIM_VIGENCIA'] >= dia)


def main(pasta, saida):
    raiz = Path(pasta)
    sql = raiz / 'flyway' / 'sql'
    arquivos = [sql / 'criacao' / 'B0001__sistema_tributario_completo.sql'] + sorted((sql / 'manutencao').glob('V*.sql'))
    db = {t: {} for t in TABELAS}
    versoes = []
    for arq in arquivos:
        texto = arq.read_text(encoding='utf-8')
        for st in statements(texto):
            mv = re.match(r"INSERT INTO VERSAO_BASE_DADO \(([^)]*)\) VALUES (.*)$", st, re.I)
            if mv:
                cols = [c.strip().upper() for c in mv.group(1).split(',')]
                for linha in valores(mv.group(2)):
                    versoes.append(dict(zip(cols, linha)))
                continue
            aplicar(st, db, arq.name)
    pom = (raiz / 'pom.xml').read_text(encoding='utf-8')
    versao_app = re.search(r'<artifactId>CalculadorTributo</artifactId>\s*<version>([^<]+)</version>', pom).group(1)
    git = subprocess.run(['git', '-C', str(raiz), 'log', '-1', '--format=%H %cs'], capture_output=True, text=True)
    commit = git.stdout.split() if git.returncode == 0 and git.stdout.strip() else [None, None]
    numeradas = [v for v in versoes if re.fullmatch(r'[Vv]\d+', v.get('VRBD_VERSAO_BASE_DADO') or '')]
    ultima = max(numeradas, key=lambda v: int(v['VRBD_VERSAO_BASE_DADO'][1:]))
    ultima['VRBD_VERSAO_BASE_DADO'] = ultima['VRBD_VERSAO_BASE_DADO'].upper()
    hoje = date.today().isoformat()

    situacoes = db['SITUACAO_TRIBUTARIA']
    reducoes = {}
    for pr in db['PERCENTUAL_REDUCAO'].values():
        if pr['PERE_TBTO_ID'] not in TRIBUTOS or not vigente(pr, 'PERE', hoje):
            continue
        cl = db['CLASSIFICACAO_TRIBUTARIA'].get(pr['PERE_CLTR_ID'])
        if cl is None or not vigente(cl, 'CLTR', hoje) or cl.get('CLTR_TIPO_ALIQUOTA') == 'Sem alíquota':
            continue
        item = reducoes.setdefault(cl['CLTR_CD'], {'cClassTrib': cl['CLTR_CD'], 'descricao': cl['CLTR_DESCRICAO'],
            'cst': situacoes[cl['CLTR_SITR_ID']]['SITR_CD'], 'cstDescricao': situacoes[cl['CLTR_SITR_ID']]['SITR_DESCRICAO'],
            'reducao': {}})
        item['reducao'][TRIBUTOS[pr['PERE_TBTO_ID']]] = round(float(pr['PERE_VALOR']), 4)
    lista = sorted((r for r in reducoes.values() if any(v > 0 for v in r['reducao'].values())),
                   key=lambda r: (-max(r['reducao'].values()), r['cClassTrib']))
    for r in lista:
        for t in TRIBUTOS.values():
            r['reducao'].setdefault(t, 0)

    aliquotas = {}
    for a in db['ALIQUOTA_REFERENCIA'].values():
        if a['ALRE_TBTO_ID'] in TRIBUTOS:
            ano = int(a['ALRE_INICIO_VIGENCIA'][:4])
            aliquotas.setdefault(ano, {'ano': ano, 'inicio': a['ALRE_INICIO_VIGENCIA'], 'fim': a['ALRE_FIM_VIGENCIA']})
            aliquotas[ano][TRIBUTOS[a['ALRE_TBTO_ID']]] = float(a['ALRE_VALOR'])

    out = {
        'fonte': {
            'nome': 'Calculadora oficial da reforma tributária (regime regular) — Receita Federal',
            'repositorio': 'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular',
            'repositorioSimples': 'https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional',
            'licenca': 'MIT — Copyright (c) 2026 Receita Federal do Brasil',
            'versaoCalculadora': versao_app,
            'commit': commit[0], 'dataCommit': commit[1],
            'versaoBaseDados': ultima['VRBD_VERSAO_BASE_DADO'], 'dataBaseDados': ultima['VRBD_DATA'][:10],
            'descricaoBaseDados': ultima['VRBD_DESCRICAO'],
            'extraidoEm': hoje,
            'arquivos': 'flyway/sql/criacao/B0001__sistema_tributario_completo.sql e flyway/sql/manutencao/V0002–' + ultima['VRBD_VERSAO_BASE_DADO'],
            'metodo': 'Leitura dos arquivos SQL como texto (scripts/extract-rtc-oficial.py); nada do repositório oficial foi executado.',
        },
        'aliquotasReferencia': [aliquotas[a] for a in sorted(aliquotas)],
        'reducoes': lista,
    }
    Path(saida).write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{len(lista)} classificações com redução; anos com alíquota: {sorted(aliquotas)}; base {out['fonte']['versaoBaseDados']}")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
