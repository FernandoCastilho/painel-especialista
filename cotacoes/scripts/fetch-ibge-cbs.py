"""Refresh public IBGE spending benchmarks. Failures preserve the last valid snapshot.
Default: validate the preserved snapshot without network access.
Use --refresh only after source access has been restored and a refresh is authorized.
No tax entitlement is inferred from an economic expense.
"""
import concurrent.futures
import argparse
import datetime
import json
import math
import pathlib
import urllib.request

DEST = pathlib.Path(__file__).resolve().parents[1] / 'src' / 'ibgeCbsSnapshot.json'
SPECS = [
    dict(kind='comercio', table=10655, classification=11070, revenue=[866, 1398], costs=[504],
         population='Empresas comerciais com 20 ou mais pessoas ocupadas',
         description='Compras de mercadorias para revenda / receita bruta de revenda e outras atividades. Não inclui todos os serviços adquiridos.'),
    dict(kind='industria', table=10474, classification=12762, revenue=[865, 866], costs=[828, 869, 831, 832, 833, 451],
         population='Empresas industriais com 5 ou mais pessoas ocupadas',
         description='Matérias-primas compradas, mercadorias para revenda (custo), energia/combustíveis, peças, serviços industriais e água / receita bruta de produtos e revenda. Mistura compras e consumo; aproximação estrutural, sem CAPEX e sem folha.'),
    dict(kind='servicos', table=10758, classification=12355, revenue=[639, 640, 641], costs=[657, 1553, 1554, 1555, 1556, 1557, 1558, 1559],
         population='Empresas de serviços não financeiros cobertas pela PAS',
         description='Mercadorias revendidas e componentes identificados do consumo intermediário / receita bruta de serviços, revenda e outras atividades. Custos não são compras de caixa; folha, depreciação e despesas genéricas não integram o numerador. Saúde e educação regular não são cobertas.'),
]

def read_json(url):
    with urllib.request.urlopen(url, timeout=22) as response:
        raw = response.read(6_000_001)
    if len(raw) > 6_000_000:
        raise ValueError('Resposta acima do limite')
    return json.loads(raw)

def collect(spec):
    table = spec['table']
    metadata_url = f'https://sidra.ibge.gov.br/Ajax/JSon/Tabela/1/{table}?versao=-1'
    metadata = read_json(metadata_url)
    year = max(int(p['Codigo']) for p in metadata['Periodos']['Periodos'] if p['Disponivel'])
    variables = spec['revenue'] + spec['costs']
    names = {v['Id']: v['Nome'] for v in metadata['Variaveis']}
    if any(v not in names for v in variables):
        raise ValueError('Variáveis esperadas ausentes nos metadados')
    classification = next(c for c in metadata['Classificacoes'] if c['Id'] == spec['classification'])
    url = f"https://apisidra.ibge.gov.br/values/t/{table}/n1/all/v/{','.join(map(str, variables))}/p/{year}/c{spec['classification']}/all"
    rows = read_json(url)
    if not isinstance(rows, list) or len(rows) < 2:
        raise ValueError('Resposta SIDRA sem valores')
    values = {}
    for row in rows[1:]:
        if row['MN'] != 'Mil Reais' or int(row['D3C']) != year:
            raise ValueError('Unidade ou período inesperado')
        # SIDRA suppression/absence symbols are never zero.
        try:
            value = float(row['V'])
            if not math.isfinite(value):
                value = None
        except ValueError:
            value = None
        values.setdefault(row['D4C'], {})[int(row['D2C'])] = value
    groups = []
    for category in classification['Categorias']:
        cells = values.get(str(category['Id']), {})
        if any(cells.get(v) is None for v in variables):
            continue
        revenue = sum(cells[v] for v in spec['revenue'])
        costs = sum(cells[v] for v in spec['costs'])
        if revenue <= 0 or costs < 0:
            continue
        groups.append(dict(id=f"{spec['kind']}-{category['Id']}", label=category['Nome'],
                           depth=category['IdentacaoApresentacao'], spendingRatio=costs/revenue,
                           revenueThousands=revenue, spendingThousands=costs,
                           values={str(v): cells[v] for v in variables}))
    if len(groups) < 5:
        raise ValueError('Cobertura insuficiente; preservar base anterior')
    return {**spec, 'year': year, 'source': f'https://sidra.ibge.gov.br/tabela/{table}',
            'query': url, 'metadataUrl': metadata_url, 'variables': {str(v): names[v] for v in variables},
            'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'groups': groups}

def main():
    old = json.loads(DEST.read_text()) if DEST.exists() else {'datasets': []}
    datasets = {d['kind']: d for d in old['datasets']}
    def safe(spec):
        try:
            return spec['kind'], collect(spec), None
        except Exception as error:
            return spec['kind'], None, str(error)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for kind, data, error in pool.map(safe, SPECS):
            if data:
                datasets[kind] = data
                print(f"IBGE {kind}: {data['year']}, {len(data['groups'])} atividades verificadas")
            else:
                print(f'IBGE {kind}: preservada base anterior; {error}')
                print(f'::warning title=IBGE CBS — atualização não concluída::{kind}: base anterior preservada; nenhuma atualização válida obtida.')
    if len(datasets) != len(SPECS):
        raise SystemExit('Base inicial incompleta; nenhum arquivo foi gravado')
    result = {'schemaVersion': 1, 'datasets': list(datasets.values())}
    if result == old:
        return  # Preserva inclusive os bytes e as datas quando nenhuma base mudou.
    temp = DEST.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temp.replace(DEST)


def validate_preserved():
    """An access denial is not retried by a routine publication."""
    snapshot = json.loads(DEST.read_text())
    datasets = snapshot['datasets']
    if sorted(d['kind'] for d in datasets) != sorted(s['kind'] for s in SPECS):
        raise ValueError('Base preservada incompleta')
    for dataset in datasets:
        if len(dataset['groups']) < 5 or not dataset.get('retrievedAt'):
            raise ValueError('Base preservada sem cobertura ou data de coleta')
        print(f"IBGE {dataset['kind']}: base {dataset['year']} preservada; coleta válida em {dataset['retrievedAt']}")
    message = 'CBS: coleta automática suspensa após falha de acesso ao IBGE (HTTP 403). Nenhuma consulta externa realizada; base e datas preservadas.'
    print(message)
    print(f'::notice title=IBGE CBS — base preservada::{message}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Consultar o IBGE somente após restauração do acesso e autorização; revisar e versionar os dados antes de publicar.')
    if parser.parse_args().refresh:
        main()
    else:
        validate_preserved()
