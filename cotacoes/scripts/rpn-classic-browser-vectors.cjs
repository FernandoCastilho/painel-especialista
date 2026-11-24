// Adaptado da matriz independente de aceitação. Nenhuma importação do motor nem uso de setDisplay.
const cases = []
const requiredBase = 'n i pv pmt fv chs 7 8 9 divide power reciprocal pctTotal pctDiff percent eex 4 5 6 multiply runStop sst roll swap clx enter 1 2 3 subtract on f g sto rcl 0 decimal sum add'
const requiredF = 'n i pv pmt fv power reciprocal pctTotal pctDiff percent runStop sst roll swap clx enter decimal 0 1 2 3 4 5 6 7 8 9'
const requiredG = 'n i pv pmt fv chs power reciprocal pctTotal pctDiff percent eex 4 5 6 7 8 9 runStop sst roll swap clx enter 0 1 2 3 decimal sum'
const required = [...requiredBase.split(' '), ...requiredF.split(' ').map(key=>'f:'+key), ...requiredG.split(' ').map(key=>'g:'+key)].sort()
const step = (kind, target, expected, difference)=>({kind,target,expected,difference})
const x = value=>step('number','visor',value)
const stack = (register,value)=>step('number','pilha:'+register,value)
const reg = (register,value)=>step('number','registro:'+register,value)
const txt = (name,expected)=>step('text',name,expected)
const has = (name,expected)=>step('match',name,expected)
const flag = (name,expected)=>step('flag',name,expected)
const counts = n=>txt('fluxos',n+' registros')
const key = (...ids)=>ids.map(id=>({kind:'key',id}))
const physical = id=>({kind:'physical',id})
function entry(value, ...tail) {
  const repr = String(Math.abs(value))
  if (!/^\d+(?:\.\d+)?$/.test(repr)) throw new Error('Fixture deve usar números finitos em formato simples.')
  return key('clx', ...[...repr].map(symbol=>symbol==='.'?'decimal':symbol), ...(value<0?['chs']:[]), ...tail)
}
const check = (name,coverage,...steps)=>cases.push({name,coverage:coverage.split(' ').filter(Boolean),steps:steps.flat()})
const B=(name,id,y,v,z)=>check(name,id,entry(y,'enter'),entry(v,id),x(z))
const U=(name,layer,id,v,z)=>check(name,(layer?layer+':':'')+id,entry(v,...(layer?[layer,id]:[id])),x(z))

for(let n=0;n<=9;n++){
  check('Dígito '+n,String(n),key(String(n)),x(n))
  check('Casas decimais f '+n,'f:'+n,entry(1,'f',String(n)),txt('visor',n?'1,'+'0'.repeat(n):'1'))
}
B('Aritmética +','add',2,3,5);B('Aritmética −','subtract',9,2,7)
B('Aritmética ×','multiply',4,5,20);B('Aritmética ÷','divide',9,4,2.25)
B('Potência','power',2,3,8)
check('Percentual preserva Y','percent',entry(50,'enter'),entry(10,'percent'),x(5),stack('Y',50))
B('Variação percentual','pctDiff',200,250,25);B('Percentual do total','pctTotal',200,50,25)
U('Recíproco',null,'reciprocal',10,.1);U('Raiz quadrada','g','power',81,9)
U('Exponencial','g','reciprocal',2,Math.exp(2));U('Logaritmo natural','g','pctTotal',7.389056099,2)
U('Parte inteira','g','percent',-3.75,-3);U('Parte fracionária','g','pctDiff',-3.75,-.75)
U('Fatorial','g','3',5,120)
check('Separador e sinal do expoente','decimal chs eex',key('f','9','2','decimal','5','eex','chs','2','enter'),x(.025))
check('Troca X/Y, ENTER, rotação, LAST X','swap enter roll g:enter',
  key('9','enter','2','subtract','g','enter'),x(2),key('swap'),x(7),key('roll'),x(2))
check('CLx, memória STO/RCL, soma na memória','clx sto rcl',
  entry(10,'sto','0'),key('clx'),x(0),entry(3,'sto','add','0'),key('rcl','0'),x(13))
check('Estado ON e retenção','on',entry(4),key('on'),txt('visor',''),flag('DESLIGADA',true),
  key('on'),x(4),flag('DESLIGADA',false))
check('Prefixos f/g e Escape','f g',key('f'),flag('f',true),key('g'),flag('f',false),flag('g',true),
  physical('Escape'),flag('g',false))
check('Backspace físico preserva os demais dígitos','',key('1','2','3'),physical('Backspace'),x(12))
check('Teclado físico C e F → C respeitam CLx e CLEAR REG','',
  physical('2'),physical('N'),physical('C'),x(0),reg('n',2),
  physical('F'),flag('f',true),physical('C'),flag('f',false),reg('n',0))
check('Teclado físico G ativa a função azul da próxima tecla','',
  physical('G'),flag('g',true),physical('7'),flag('BEGIN',true),
  physical('g'),physical('8'),flag('END',true),
  physical('g'),physical('c'),flag('g',false))
check('PREFIX mostra X completo','f:enter',entry(1.2345),key('f','enter'),has('status',/1\.2345/))
check('Modo científico e RND','f:decimal f:pmt',entry(1.236,'f','decimal'),has('visor',/E/),key('f','pmt'),x(1.24))
check('f FIN limpa registros financeiros','f:swap',entry(6,'i'),key('f','swap'),reg('i',0))
check('f REG limpa memória e X','f:clx',entry(6,'sto','1'),key('f','clx'),x(0),key('rcl','1'),x(0))
check('TVM, anos para meses, taxa mensal e BEGIN/END','n i pv pmt fv g:n g:i g:7 g:8',
  entry(2,'n'),entry(120,'g','i'),entry(1000,'pv'),entry(0,'pmt'),key('fv'),x(-1210),
  reg('i',10),entry(1,'g','n'),x(12),key('g','7'),flag('BEGIN',true),key('g','8'),flag('END',true))
check('Indicador C para período irregular','',key('sto','eex'),flag('C',true),key('sto','eex'),flag('C',false))
check('INT atualiza X/Y/Z','f:i',entry(-450,'pv'),entry(7,'i'),entry(60,'n'),key('f','i'),
  x(5.25),stack('Y',450),stack('Z',5.178082191780822))
check('AMORT atualiza X/Y/Z e registros','f:n',entry(1000,'pv'),entry(10,'i'),entry(-576.19,'pmt'),entry(1,'f','n'),
  x(-100),stack('Y',-476.19),stack('Z',1),reg('PV',523.81),reg('n',1))
const flow=()=>[...entry(-1000,'g','pv'),...entry(600,'g','pmt'),...entry(2,'g','fv')]
check('Fluxos, repetições, VPL/TIR','g:pv g:pmt g:fv f:pv f:fv',flow(),counts(3),entry(10,'i'),key('f','9','f','pv'),
  x(41.3223140495868),key('f','fv'),x(13.0662386291808))
check('Fluxos integrados à memória','sto rcl g:fv',flow(),entry(700,'sto','1'),txt('fluxo:0','-1.000'),
  txt('fluxo:1','700'),txt('fluxo:2','700'))
check('PRICE e YTM a par, cupom corrido zero','f:power f:reciprocal',
  entry(8,'pmt'),entry(8,'i'),entry(1.012026,'enter'),entry(1.012027,'f','power'),x(100),stack('Y',0),
  entry(1.012026,'enter'),entry(1.012027,'f','reciprocal'),x(8))
for(const [id,residual,book] of [['pctTotal',1900,7600],['pctDiff',3166.6666666666665,6333.333333333333],['percent',4000,5500]])
  check('Depreciação '+id,'f:'+id,entry(10000,'pv'),entry(500,'fv'),entry(5,'n'),entry(200,'i'),entry(1,'f',id),x(residual),stack('Y',book))
check('DATE, dia da semana, D.MY e M.DY','g:chs g:4 g:5',key('g','4'),flag('D.MY',true),key('g','5'),flag('D.MY',false),
  entry(2.282024,'enter'),entry(1,'g','chs'),has('visor',/2024\D+4$/))
check('ΔDYS, dias corridos e base 30/360','g:eex',entry(1.012023,'enter'),entry(3.012023,'g','eex'),x(59),stack('Y',60))
const stats=()=>[[1,1],[2,2],[3,4]].flatMap(([a,b])=>[...entry(b,'enter'),...entry(a,'sum')])
check('Σ+, média, desvio, remoção e limpeza','sum g:0 g:decimal g:sum f:sst',
  stats(),key('g','0'),x(2),key('g','decimal'),x(1),entry(4,'enter'),entry(3,'g','sum'),x(2),
  key('g','0'),x(1.5),key('f','sst'),x(0))
check('Média ponderada','g:6',entry(10,'enter'),entry(1,'sum'),entry(20,'enter'),entry(3,'sum'),key('g','6'),x(17.5))
check('Regressão direta ŷ','g:2',stats(),entry(4,'g','2'),x(16/3),stack('Y',.9819805060619659))
check('Regressão inversa x̂','g:1',stats(),entry(4,'g','1'),x(28/9))
check('MEM mostra alocação inicial','g:9',key('g','9'),txt('visor','P-08 r-20'))
check('P/R, SST, BST, GTO, R/S e limpeza','f:runStop sst g:sst g:roll runStop f:roll',
  key('f','runStop'),flag('PRGM',true),key('enter','2','multiply'),has('visor',/^03/),
  key('f','runStop','g','roll','0','0'),flag('PRGM',false),entry(7,'sst'),x(7),
  key('g','sst','runStop'),x(14),key('f','runStop','f','roll'),has('visor',/^00\b/))
check('Condicional x=0: ramo falso','g:clx',key('f','runStop','g','clx','5','f','runStop','g','roll','0','0'),entry(1,'runStop'),x(1))
check('Condicional x≤y: ramo verdadeiro','g:swap',
  key('f','runStop','g','swap','5','f','runStop','g','roll','0','0'),entry(2,'enter'),entry(1,'runStop'),x(5))
check('PSE pausa e retoma sem clique','g:runStop',
  key('f','runStop','enter','g','runStop','2','multiply','f','runStop','g','roll','0','0'),entry(7,'runStop'),
  flag('PAUSA',true),x(7),{kind:'waitFlag',target:'PAUSA',expected:false},x(14))

// Official HP worked examples also act as regressions for the three faults found independently.
const statsHp=()=>[[17000,32],[25000,40],[26000,45],[20000,40],[21000,38],[28000,50],[15000,35]]
  .flatMap(([a,b])=>[...entry(b,'enter'),...entry(a,'sum')])
check('HP p.80 regressão inversa e ida e volta','g:1 g:2',statsHp(),entry(48,'g','1'),x(28818.93),stack('Y',.900524466594),
  entry(28818.93,'g','2'),x(48))
check('HP pp.65–66 fluxos STO/RCL e Nj corrigem VPL','sto rcl g:fv f:pv f:fv',
  entry(-79000,'g','pv'),entry(14000,'g','pmt'),entry(11000,'g','pmt'),entry(10000,'g','pmt'),entry(3,'g','fv'),
  entry(9100,'g','pmt'),entry(9000,'g','pmt'),entry(2,'g','fv'),entry(4500,'g','pmt'),entry(100000,'g','pmt'),
  key('rcl','2'),x(11000),entry(9000,'sto','2','rcl','2'),x(9000),entry(13.5,'i'),key('f','pv'),x(-644.75),
  entry(5,'n'),key('rcl','g','fv'),x(2),key('rcl','g','pmt'),x(9000),reg('n',4),
  entry(5,'n'),entry(4,'g','fv'),entry(7,'n'),key('f','pv'),x(-1857.21),key('f','fv'),x(13.087295480830),
  key('f','pv'),step('number','visor',0,1e-5))
check('HP pp.29–31 DATE oficial e limites sem adulterar X/Y','g:chs g:4',
  key('g','4'),entry(14.052004,'enter'),entry(120,'g','chs'),txt('visor','11,09,2004 6'),
  entry(15.101582,'enter'),entry(0,'g','chs'),txt('visor','15,10,1582 5'),
  entry(25.114046,'enter'),entry(0,'g','chs'),has('visor',/^25,11,4046 [1-7]$/),
  entry(14.101582,'enter'),entry(0,'g','chs'),has('status',/inválida|intervalo/),x(0),stack('Y',14.101582))
check('DATE programado exibe dia da semana durante pausa','g:chs',
  key('g','4','f','runStop','g','chs','2','f','runStop','g','roll','0','0'),
  entry(14.052004,'enter'),entry(120,'runStop'),flag('PAUSA',true),txt('visor','11,09,2004 6'),
  {kind:'waitFlag',target:'PAUSA',expected:false},x(2))

// HP manual: integrity of ordinary/financial/Σ registers and of program editing.
const rclChecks=(entries)=>entries.flatMap(([id,result])=>[...key('rcl',id),x(result)])
const zeros = () => rclChecks(['1','2','3','4','5','6'].map(id=>[id,0]))
check('HP pp.76–77 estatística compartilha R1–R6, CLEAR Σ preserva R0/R7','sum g:sum f:sst',
  entry(70,'sto','0'),entry(71,'sto','7'),entry(4,'enter'),entry(3,'sum'),
  rclChecks([['1',1],['2',3],['3',9],['4',4],['5',16],['6',12]]),
  entry(9,'sto','2','g','0'),x(9),entry(3,'sto','2'),entry(4,'enter'),entry(3,'g','sum'),zeros(),
  entry(4,'enter'),entry(3,'sum','f','sst'),zeros(),rclChecks([['0',70],['7',71]]))
check('HP p.24 limites de STO aritmético preservam destinos inválidos','sto rcl',
  entry(20,'sto','0','sto','4','sto','5','sto','decimal','0','sto','pv'),
  entry(2,'sto','divide','0','sto','multiply','4'),rclChecks([['0',10],['4',40]]),
  entry(2,'sto','add','5'),has('status',/R0 a R4/),x(2),key('rcl','5'),x(20),
  entry(2,'sto','add','decimal','0'),has('status',/R0 a R4/),x(2),key('rcl','decimal','0'),x(20),
  entry(2,'sto','add','pv'),has('status',/R0 a R4/),x(2),reg('PV',20))
check('HP pp.91–96 GTO ponto sobrescreve, não insere; keycodes','g:roll sst f:runStop',
  key('f','runStop'),txt('visor','00-'),key('enter'),txt('visor','01- 36'),
  key('2','5','percent'),txt('visor','04- 25'),key('g','roll','decimal','0','2','9'),txt('visor','03- 9'),
  key('sst'),txt('visor','04- 25'),key('sto','add','2'),txt('visor','05- 44 40 2'),
  key('rcl','decimal','3'),txt('visor','06- 45 48 3'),key('g','roll','decimal','0','7'),txt('visor','07- 43 33 00'))
check('HP pp.94–95 MEM realoca R.9 e usa FV para fluxo reservado','g:9 f:roll g:pmt',
  entry(42,'sto','decimal','9','f','runStop'),key(...Array(9).fill('1'),'g','9'),txt('visor','P-15 r-19'),
  key('f','runStop','rcl','decimal','9'),has('status',/memória de programa/),
  entry(-19,'g','pv'),Array.from({length:19},(_,i)=>entry(i+1,'g','pmt')).flat(),reg('FV',19),counts(20),
  key('f','runStop','f','roll','f','runStop','g','9'),txt('visor','P-08 r-20'),key('rcl','decimal','9'),x(0))

// Regressões V6: precisão estatística e proteção do CF real durante realocação.
check('Desvio amostral distingue valores separados por 1 em torno de 100 milhões','sum g:decimal g:sum',
  [100000000,100000001,100000002].flatMap(value=>entry(value,'sum')),
  key('g','decimal'),x(1),entry(0,'enter'),entry(100000002,'g','sum','g','decimal'),x(Math.SQRT1_2))
check('PRGM protege CF19 contra colisão com FV e bloqueia VPL/TIR até revisão','f:runStop f:roll f:pv f:fv',
  entry(-30,'g','pv'),Array.from({length:19},(_,i)=>entry(i+1,'g','pmt')).flat(),entry(700,'fv'),
  txt('fluxo:19','19'),reg('FV',700),
  key('f','runStop',...Array(9).fill('1')),has('status',/informe novamente/),counts(19),txt('fluxo:18','18'),reg('FV',700),
  key('f','runStop','f','pv'),has('status',/n o número/),
  entry(18,'n'),entry(19,'g','pmt'),counts(20),txt('fluxo:19','19'),reg('FV',19),
  key('f','runStop','f','roll'),has('status',/informe novamente/),counts(19),txt('fluxo:18','18'),
  key('f','runStop','f','fv'),has('status',/n o número/))

function parseDisplay(text) {
  const input = String(text).trim().replaceAll('−','-')
  if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d*)?|,\d+)(?:[Ee][+-]?\d+)?$/.test(input)) return NaN
  return Number(input.replaceAll('.','').replace(',', '.'))
}
function displayedTolerance(text) {
  const input = String(text).trim().replaceAll('−','-')
  const match = input.match(/^[+-]?[\d.]+(?:,(\d*))?(?:[Ee]([+-]?\d+))?$/)
  return match ? 0.500001*10**(Number(match[2]??0)-(match[1]?.length??0)) : 0
}
module.exports = { cases, required, parseDisplay, displayedTolerance }
