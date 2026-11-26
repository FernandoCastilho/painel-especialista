import datetime as dt
import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from urllib.error import HTTPError
import zipfile

spec = importlib.util.spec_from_file_location('fichas', Path(__file__).resolve().parents[1] / 'scripts/coletar-fichas-cvm.py')
fichas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fichas)
CLASSE, LEGADO, SEM_LAMINA = '11111111000111', '22222222000122', '33333333000133'


def csv_texto(cabecalho, *linhas):
    return ';'.join(cabecalho) + '\n' + '\n'.join(';'.join(linha) for linha in linhas) + '\n'


def zipar(arquivos):
    dados = io.BytesIO()
    with zipfile.ZipFile(dados, 'w') as zipado:
        for nome, conteudo in arquivos.items():
            zipado.writestr(nome, conteudo.encode('latin1'))
    return dados.getvalue()


CADASTRO = zipar({
    'registro_fundo.csv': csv_texto(['CNPJ_Fundo', 'Codigo_CVM', 'Tipo_Fundo', 'Situacao', 'Data_Registro', 'Patrimonio_Liquido', 'Data_Patrimonio_Liquido'],
                                    ['22.222.222/0001-22', '555', 'FI', 'Em Funcionamento Normal', '2010-01-04', '1000.5', '2026-11-19']),
    'registro_classe.csv': csv_texto(['CNPJ_Classe', 'Codigo_CVM', 'Classificacao', 'Classificacao_Anbima', 'Publico_Alvo', 'Exclusivo',
                                      'Tributacao_Longo_Prazo', 'Indicador_Desempenho', 'Forma_Condominio', 'Situacao', 'Data_Inicio',
                                      'Patrimonio_Liquido', 'Data_Patrimonio_Liquido'],
                                     ['11.111.111/0001-11', '120898', 'Renda Fixa', 'Renda Fixa Indexados', 'Público Geral', 'N', 'S',
                                      'DI de um dia', 'Aberto', 'Em Funcionamento Normal', '2024-07-08', '6490000000', '2026-11-19'],
                                     ['33.333.333/0001-33', '48771', 'Ações', 'Ações Livre', 'Qualificado', 'N', 'N/A', 'Ibovespa',
                                      'Aberto', 'Em Funcionamento Normal', '2020-02-03', '10', '2026-11-19']),
})
EXTRATO = csv_texto(['CNPJ_FUNDO_CLASSE', 'DT_COMPTC', 'APLIC_MIN', 'QT_DIA_CONVERSAO_COTA', 'QT_DIA_PAGTO_RESGATE', 'TP_DIA_PAGTO_RESGATE',
                     'TAXA_ADM', 'EXISTE_TAXA_PERFM', 'TAXA_PERFM', 'POLIT_INVEST'],
                    ['33.333.333/0001-33', '2026-01-31', '500', '30', '32', 'Dias Úteis', '1.5', 'S', '20', 'antiga'],
                    ['33.333.333/0001-33', '2026-03-31', '1', '21', '21', 'Dias Corridos', '0.06', 'N', '', 'ATIVA   E \tNÃO-REFERENCIADA'])
LAMINA_CAB = ['TP_FUNDO_CLASSE', 'CNPJ_FUNDO_CLASSE', 'ID_SUBCLASSE', 'DENOM_SOCIAL', 'DT_COMPTC', 'NM_FANTASIA', 'OBJETIVO', 'PUBLICO_ALVO',
              'INVEST_INICIAL_MIN', 'QT_DIA_CONVERSAO_COTA_RESGATE', 'QT_DIA_PAGTO_RESGATE', 'TAXA_ADM', 'CLASSE_RISCO_ADMIN', 'INDICE_REFER',
              'PR_PL_DESPESA', 'VL_PATRIM_LIQ', 'RISCO_PERDA_NEGATIVO']


def lamina(competencia, objetivo, subclasse_extra=False):
    linhas = [['CLASSES - FIF', '11.111.111/0001-11', '', 'ALFA', competencia, 'ALFA RF', objetivo, 'Público em geral', '0', '0', '1',
               '0.5', '3', 'CDI', '0.04', '1690000000', 'N']]
    if subclasse_extra:
        linhas.append(['CLASSES - FIF', '11.111.111/0001-11', 'SUB1', 'ALFA', competencia, 'ALFA SUB', 'da subclasse', 'x', '0', '0', '1',
                       '0.5', '3', 'CDI', '0.04', '1', 'N'])
    ano, mes = competencia[:4], competencia[5:7]
    return zipar({
        f'lamina_fi_{ano}{mes}.csv': csv_texto(LAMINA_CAB, *linhas),
        f'lamina_fi_carteira_{ano}{mes}.csv': csv_texto(['CNPJ_FUNDO_CLASSE', 'ID_SUBCLASSE', 'DT_COMPTC', 'TP_ATIVO', 'PR_PL_ATIVO'],
                                                       ['11.111.111/0001-11', '', competencia, 'Títulos públicos federais', '3.52'],
                                                       ['11.111.111/0001-11', '', competencia, 'Derivativos', '-3.78'],
                                                       ['11.111.111/0001-11', '', competencia, 'Crédito privado', '86.31']),
        f'lamina_fi_rentab_ano_{ano}{mes}.csv': csv_texto(['CNPJ_FUNDO_CLASSE', 'ID_SUBCLASSE', 'DT_COMPTC', 'ANO_RENTAB', 'PR_RENTAB_ANO',
                                                           'PR_VARIACAO_INDICE_REFER_ANO', 'PR_PERFM_INDICE_REFER_ANO'],
                                                          ['11.111.111/0001-11', '', competencia, '2025', '14.95', '14.31', '104.4'],
                                                          ['11.111.111/0001-11', '', competencia, '2024', '9.59', '10.87', '88.2']),
        f'lamina_fi_rentab_mes_{ano}{mes}.csv': csv_texto(['CNPJ_FUNDO_CLASSE', 'ID_SUBCLASSE', 'DT_COMPTC', 'MES_RENTAB', 'PR_RENTAB_MES',
                                                           'PR_VARIACAO_INDICE_REFER_MES'],
                                                          ['11.111.111/0001-11', '', competencia, '11', '0.7', '1.0'],
                                                          ['11.111.111/0001-11', '', competencia, '1', '3.8', '1.1']),
    })


class FichasCvm(unittest.TestCase):
    def ler(self, url):
        if url == fichas.CADASTRO:
            return CADASTRO
        if url == fichas.EXTRATO.format(ano=2026):
            return EXTRATO.encode('latin1')
        if url == fichas.LAMINA.format(competencia='202610'):
            return lamina('2026-10-31', 'Objetivo de outubro', subclasse_extra=True)
        if url == fichas.LAMINA.format(competencia='202609'):
            return lamina('2026-09-30', 'Objetivo antigo')
        raise HTTPError(url, 404, 'ausente', None, None)

    def coletar(self, documentos):
        with tempfile.TemporaryDirectory() as pasta:
            pasta = Path(pasta)
            fichas.coletar(pasta, dt.date(2026, 11, 26), documentos, self.ler)
            manifest = fichas.manifest_validado((pasta / 'manifest.json').read_bytes())
            todas = {}
            for arquivo in manifest['files'].values():
                todas.update(json.loads(gzip.decompress((pasta / arquivo).read_bytes())))
            return manifest, todas

    def test_lamina_mais_recente_da_classe_com_rentabilidade_e_carteira(self):
        manifest, todas = self.coletar({CLASSE})
        self.assertEqual((manifest['fichas'], manifest['laminas']), (1, 1))
        lamina_fundo = todas[CLASSE]['lamina']
        self.assertEqual(lamina_fundo['data'], '2026-10-31')
        self.assertEqual(lamina_fundo['objetivo'], 'Objetivo de outubro')
        self.assertNotIn('subclasse', lamina_fundo)
        self.assertEqual(lamina_fundo['anos'], [[2024, 9.59, 10.87, 88.2], [2025, 14.95, 14.31, 104.4]])
        self.assertEqual(lamina_fundo['meses'], [['2025-11', 0.7, 1.0], ['2026-01', 3.8, 1.1]])
        self.assertEqual(lamina_fundo['carteira'][0], ['Crédito privado', 86.31])
        self.assertEqual(lamina_fundo['carteira'][-1], ['Títulos públicos federais', 3.52])
        self.assertIs(lamina_fundo['perdaAlemDoAplicado'], False)
        self.assertEqual(todas[CLASSE]['cadastro']['codigo'], '120898')

    def test_sem_lamina_usa_cadastro_e_extrato_mais_recente(self):
        _, todas = self.coletar({SEM_LAMINA, LEGADO, '99999999000199'})
        ficha = todas[SEM_LAMINA]
        self.assertNotIn('lamina', ficha)
        self.assertEqual(ficha['cadastro']['publico'], 'Qualificado')
        self.assertIsNone(ficha['cadastro'].get('longoPrazo'))
        self.assertEqual(ficha['extrato']['data'], '2026-03-31')
        self.assertEqual(ficha['extrato']['politica'], 'ATIVA E NÃO-REFERENCIADA')
        self.assertIs(ficha['extrato']['performance'], False)
        self.assertEqual(todas[LEGADO]['cadastro'], {'codigo': '555', 'tipo': 'FI', 'situacao': 'Em Funcionamento Normal',
                                                     'inicio': '2010-01-04', 'pl': 1000.5, 'dataPl': '2026-11-19'})
        self.assertNotIn('99999999000199', todas)

    def test_cada_fundo_fica_no_arquivo_do_seu_grupo(self):
        manifest, _ = self.coletar({CLASSE, SEM_LAMINA})
        with tempfile.TemporaryDirectory() as pasta:
            pasta = Path(pasta)
            fichas.coletar(pasta, dt.date(2026, 11, 26), {CLASSE, SEM_LAMINA}, self.ler)
            grupo = json.loads(gzip.decompress((pasta / manifest['files'][str(fichas.bucket(CLASSE))]).read_bytes()))
            self.assertIn(CLASSE, grupo)

    def test_sem_cadastro_nem_lamina_falha(self):
        with tempfile.TemporaryDirectory() as pasta, self.assertRaises(ValueError):
            fichas.coletar(Path(pasta), dt.date(2026, 11, 26), {CLASSE}, lambda url: (_ for _ in ()).throw(HTTPError(url, 404, 'x', None, None))
                           if url != fichas.CADASTRO else CADASTRO)


if __name__ == '__main__':
    unittest.main()
