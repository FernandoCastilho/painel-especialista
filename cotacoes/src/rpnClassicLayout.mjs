// Grade física HP 12C clássica, não Platinum. O controlador decide disponibilidade e semântica.
const key = (id, label, name = label, gold = '', blue = '') => Object.freeze({ id, label, name, gold, blue })
const rows = [
  [key('n','n','Número de períodos','AMORT','12×'), key('i','i','Taxa por período','INT','12÷'),
    key('pv','PV','Valor presente','NPV','CF₀'), key('pmt','PMT','Pagamento periódico','RND','CFⱼ'),
    key('fv','FV','Valor futuro','IRR','Nⱼ'), key('chs','CHS','Trocar sinal','','DATE'),
    key('7','7','7','','BEG'), key('8','8','8','','END'), key('9','9','9','','MEM'), key('divide','÷','Dividir')],
  [key('power','yˣ','Potência: Y elevado a X','PRICE','√x'), key('reciprocal','1/x','Recíproco','YTM','eˣ'),
    key('pctTotal','%T','Percentual do total','SL','LN'), key('pctDiff','Δ%','Variação percentual','SOYD','FRAC'),
    key('percent','%','Porcentagem','DB','INTG'), key('eex','EEX','Entrar expoente','','ΔDYS'),
    key('4','4','4','','D.MY'), key('5','5','5','','M.DY'), key('6','6','6','','x̄w'), key('multiply','×','Multiplicar')],
  [key('runStop','R/S','Executar ou parar','P/R','PSE'), key('sst','SST','Avançar programa','Σ','BST'),
    key('roll','R↓','Girar pilha para baixo','PRGM','GTO'), key('swap','x↔y','Trocar X e Y','FIN','x≤y'),
    key('clx','CLx','Limpar X','REG','x=0'), key('enter','ENTER','Enter: separar os números','PREFIX','LST x'),
    key('1','1','1','','x̂,r'), key('2','2','2','','ŷ,r'), key('3','3','3','','n!'), key('subtract','−','Subtrair')],
  [key('on','ON','Ligar ou desligar'), key('f','f','Prefixo f: funções douradas'),
    key('g','g','Prefixo g: funções azuis'), key('sto','STO','Guardar na memória'),
    key('rcl','RCL','Recuperar da memória'), null, key('0','0','0','','x̄'),
    key('decimal','.','Separador decimal','','s'), key('sum','Σ+','Somar à estatística','','Σ−'), key('add','+','Somar')],
]
export const classicKeyRows = Object.freeze(rows.map(row => Object.freeze(row)))
const handRows = [
  [...rows[0].slice(0, 5)], [...rows[1].slice(0, 5)],
  [...rows[2].slice(0, 5)], [...rows[3].slice(0, 5)],
  [rows[0][6], rows[0][7], rows[0][8], rows[0][9], rows[0][5]],
  [rows[1][6], rows[1][7], rows[1][8], rows[1][9], rows[1][5]],
  [rows[2][6], rows[2][7], rows[2][8], rows[2][9], rows[2][5]],
  [rows[3][6], rows[3][7], rows[3][8], rows[3][9], null],
]
export const portraitKeyRows = Object.freeze(handRows.map(row => Object.freeze(row)))

export function getClassicKeyState(controller, key, view) {
  const powered = view.indicators?.on !== false
  const layer = view.shift === 'f' || view.shift === 'g' ? view.shift : null
  const prefix = ['f', 'g'].includes(key.id)
  const alt = layer === 'f' ? key.gold : layer === 'g' ? key.blue : ''
  return {
    label: alt ? `${layer} · ${alt}` : key.name,
    unavailable: (powered || key.id === 'on') && !controller?.isSupported(key.id),
    disabled: !powered && key.id !== 'on',
    pressed: prefix ? layer === key.id : undefined,
  }
}
