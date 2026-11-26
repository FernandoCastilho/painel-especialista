import datetime as dt
import importlib.util
import gzip
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile


spec = importlib.util.spec_from_file_location('coletor', Path(__file__).resolve().parents[1] / 'scripts/coletar-fundos-cvm.py')
coletor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coletor)
DOCUMENTO = '00017024000153'
MES = '2026-11'
CABECALHO = 'TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_QUOTA\n'


def zipar(arquivos):
    dados = io.BytesIO()
    with zipfile.ZipFile(dados, 'w') as zipado:
        for nome, conteudo in arquivos.items():
            zipado.writestr(nome, conteudo.encode('latin1'))
    return dados.getvalue()


def informe(texto):
    return zipar({'inf_diario_fi_202611.csv': texto})


class ColetaCvm(unittest.TestCase):
    def test_nao_junta_fundo_classe_e_subclasse_com_mesmo_cnpj(self):
        linhas = CABECALHO + '\n'.join([
            f'FI;{DOCUMENTO};;{MES}-02;10',
            f'CLASSES - FIF;{DOCUMENTO};;{MES}-02;100',
            f'CLASSES - FIF;{DOCUMENTO};A1;{MES}-02;120',
            f'CLASSES - FIF;{DOCUMENTO};;{MES}-03;101',
        ])
        series, conflitos = {}, set()
        coletor.juntar_informe(informe(linhas), MES, series, conflitos, set())
        self.assertFalse(conflitos)
        self.assertEqual(series, {
            f'cvm-f-{DOCUMENTO}': {MES + '-02': 10},
            f'cvm-c-{DOCUMENTO}': {MES + '-02': 100, MES + '-03': 101},
            f'cvm-c-{DOCUMENTO}-A1': {MES + '-02': 120},
        })

    def test_usa_nomes_do_cadastro_compativel_com_o_informe(self):
        nomes = ({DOCUMENTO: 'Nome vigente'}, {DOCUMENTO: 'Nome anterior'}, {
            DOCUMENTO: ('1', 'Nome da classe', ('Nome vigente', DOCUMENTO)),
        }, {('1', 'A1'): 'Varejo'})
        self.assertEqual(coletor.identidade(f'cvm-f-{DOCUMENTO}', nomes)[1], 'Nome anterior')
        self.assertEqual(coletor.identidade(f'cvm-c-{DOCUMENTO}-A1', nomes)[1], 'Nome da classe · Varejo')
        sem_classe = (nomes[0], nomes[1], {}, {})
        self.assertEqual(coletor.identidade(f'cvm-c-{DOCUMENTO}', sem_classe)[1], 'Nome vigente')

    def test_retem_o_pacote_anterior_quando_o_informe_chega_vazio_ou_truncado(self):
        with tempfile.TemporaryDirectory() as tmp:
            pasta = Path(tmp)
            cache = pasta / 'cache'
            cache.mkdir()
            arquivos = {'catalogo': coletor.gravar(cache, 'catalogo', [])}
            for numero in range(coletor.BUCKETS):
                arquivos[str(numero)] = coletor.gravar(cache, f'cotas-{numero}', {})
            anterior = json.dumps({'version': 1, 'collected': '2026-11-19', 'last': '2026-11-18', 'files': arquivos})
            (cache / 'manifest.json').write_text(anterior)
            for texto in ('', CABECALHO + f'FI;{DOCUMENTO}\n'):
                with self.subTest(texto=texto):
                    def coletar(pasta, hoje):
                        self.assertEqual(hoje, dt.date(2026, 11, 20))
                        coletor.juntar_informe(informe(texto), MES, {}, set(), set())
                    args = ['coletor', str(pasta / 'site'), '--cache', str(cache), '--origem', 'https://site.invalid',
                            '--hoje', '2026-11-20', '--atualizar']
                    with patch.object(sys, 'argv', args), patch.object(coletor, 'coletar', coletar):
                        coletor.main()
                    self.assertEqual((pasta / 'site' / 'manifest.json').read_text(), anterior)
                    for arquivo in arquivos.values():
                        self.assertEqual((pasta / 'site' / arquivo).read_bytes(), (cache / arquivo).read_bytes())
                        # A rede do banco barra .gz; a mesma base sai também em JSON comum.
                        comum = (pasta / 'site' / arquivo.removesuffix('.gz')).read_bytes()
                        self.assertEqual(json.loads(comum), json.loads(gzip.decompress((cache / arquivo).read_bytes())))


if __name__ == '__main__':
    unittest.main()
