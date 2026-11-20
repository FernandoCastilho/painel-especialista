// Acceptance matrix exercised through the real RPN controls in disposable browser contexts.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const { cases, required, parseDisplay, displayedTolerance } = require('./rpn-classic-browser-vectors.cjs')
const launchOptions = require('./smoke-launch.cjs')
const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768')
const out = process.env.RPN_CLASSIC_QA_OUTPUT || 'workspace-qa/rpn-classic-matrix'
const variants = [
  { width: 1440, theme: 'light', touch: false },
  { width: 390, theme: 'dark', touch: true },
]
const digest = row => ({
  name: row.name,
  path: row.steps.filter(s=>s.kind==='key'||s.kind==='physical').map(s=>s.kind==='physical'?'teclado:'+s.id:s.id).join(' → '),
})

async function createSuite(browser, variant) {
  const { width, theme, touch } = variant
  const context = await browser.newContext({
    viewport: { width, height: 1000 }, hasTouch: touch, colorScheme: theme, serviceWorkers: 'block',
  })
  // Keep the local CI invocation isolated from external services.
  await context.route('**/*', route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort())
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  const panel = page.getByRole('region', { name: 'Calculadora RPN', exact: true })
  const keypad = panel.getByRole('group', { name: 'Teclado da calculadora', exact: true })
  const display = panel.getByLabel('Resultado da calculadora', { exact: true })
  const indicators = panel.locator('.rpn-indicators')
  const readouts = panel.locator('.rpn-readouts')
  const status = panel.locator('.rpn-message[role="status"]')
  const flags = label => label === 'C'
    ? indicators.getByText('Juros compostos na fração de período', { exact: true })
    : indicators.getByText(label, { exact: true })

  async function fresh(first) {
    if (first) {
      await page.goto(new URL('#rpn', base).href)
      await keypad.waitFor()
      const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
      await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected, theme)
    } else {
      await page.evaluate(()=>{ location.hash='calculadora' })
      await panel.waitFor({state:'hidden'})
      await page.evaluate(()=>{ location.hash='rpn' })
    }
    await keypad.waitFor()
    assert.equal(await keypad.count(),1,'só uma grade acessível')
    assert.equal(await keypad.getByRole('button').count(),39,'39 botões visíveis na grade ativa')
  }

  async function showReadouts() {
    if (await readouts.getAttribute('open') === null) await readouts.locator('summary').click()
  }
  async function value(target) {
    if (target==='visor') return (await display.textContent()).trim()
    if (target==='status') return (await status.innerText()).trim()
    await showReadouts()
    if (target==='fluxos') return (await readouts.getByRole('group',{name:'Fluxo de caixa',exact:true}).locator('p').innerText()).trim()
    const [kind,id] = target.split(':')
    if (kind==='fluxo') return (await readouts.getByRole('group',{name:'Fluxo de caixa',exact:true}).locator('li').nth(Number(id)).innerText()).trim()
    const section = kind==='pilha'
      ? readouts.getByRole('complementary',{name:'Pilha de valores',exact:true})
      : readouts.getByRole('group',{name:'Registros financeiros',exact:true})
    return (await section.getByText(id,{exact:true}).locator('..').locator('dd').innerText()).trim()
  }

  async function apply(step) {
    if (step.kind==='key') {
      const control=keypad.locator('button[data-key="'+step.id+'"]')
      assert.ok(await control.isEnabled(), 'tecla '+step.id+' indisponível: '+await control.getAttribute('aria-label'))
      await (touch ? control.tap() : control.click())
      return null
    }
    if (step.kind==='physical') { await panel.focus(); await panel.press(step.id); return null }
    if (step.kind==='waitFlag') {
      await flags(step.target).waitFor({state:step.expected?'visible':'hidden',timeout:3500})
      return step.expected
    }
    if (step.kind==='flag') {
      const got=await flags(step.target).isVisible()
      assert.equal(got,step.expected, 'indicador '+step.target)
      return got
    }
    const obtained=await value(step.target)
    if (step.kind==='text') assert.equal(obtained,step.expected,step.target)
    else if (step.kind==='match') assert.match(obtained,step.expected,step.target)
    else if (step.kind==='number') {
      const parsed=parseDisplay(obtained)
      // The visible value must be right to its rendered precision, never looser than half a cent.
      const tol=step.difference??Math.min(.00500001,displayedTolerance(obtained))
      assert.ok(Number.isFinite(parsed)&&Math.abs(parsed-step.expected)<=tol+1e-12,
        step.target+': esperado '+step.expected+', obtido '+JSON.stringify(obtained)+' (tolerância de exibição '+tol+')')
    } else throw Error('Passo desconhecido: '+step.kind)
    return obtained
  }

  const results=[]
  const variantFile=path.join(out,`matrix-${width}-${theme}.json`)
  const publishProgress=(covered,state,extra={})=> {
    const report={...variant,state,passed:results.filter(row=>row.ok).length,total:cases.length,
      required:required.length,missing:required.filter(id=>!covered.has(id)),results,...extra}
    fs.writeFileSync(variantFile,JSON.stringify(report,null,2))
    return report
  }
  try {
    const covered=new Set()
    publishProgress(covered,'initializing')
    try {
      await fresh(true)
      await page.screenshot({path:path.join(out,`keyboard-${width}-${theme}.png`),fullPage:true,timeout:5000})
    } catch (error) {
      const setup=publishProgress(covered,'setup-error',{setupError:String(error?.message??error)})
      await page.screenshot({path:path.join(out,`setup-failure-${width}-${theme}.png`),timeout:5000}).catch(()=>{})
      return setup
    }
    for (const [index,row] of cases.entries()) {
      const result={...digest(row), coverage:row.coverage, checks:[]}
      let stepIndex=-1
      publishProgress(covered,'running',{active:result.name})
      try {
        if (index>0) await fresh(false)
        for (const [i,step] of row.steps.entries()) {
          stepIndex=i
          const received=await apply(step)
          if (received!==null) result.checks.push({step:i+1,target:step.target, expected:step.expected instanceof RegExp ? String(step.expected) : step.expected, received})
        }
        for(const part of row.coverage) covered.add(part)
        result.ok=true
      } catch(error) {
        const step=row.steps[stepIndex]
        result.ok=false
        result.step=step ? {...step, expected:step.expected instanceof RegExp ? String(step.expected) : step.expected} : null
        result.stepIndex=stepIndex+1
        result.error=String(error?.message??error)
        result.state=await panel.locator('.rpn-console').count() ? {
          visor:await display.textContent({timeout:700}).catch(()=>null),
          indicadores:await indicators.innerText({timeout:700}).catch(()=>null),
          mensagem:await status.innerText({timeout:700}).catch(()=>null),
          ariaPrefixos:await keypad.locator('button[aria-pressed="true"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-key'))).catch(()=>[]),
        } : null
        await page.screenshot({path:path.join(out,`failure-${width}-${theme}-${index+1}.png`),timeout:5000}).catch(()=>{})
      }
      results.push(result)
      publishProgress(covered,'running')
    }
    const passed=results.every(row=>row.ok)&&required.every(id=>covered.has(id))
    return publishProgress(covered,passed?'passed':'failed')
  } finally { await context.close() }
}

async function main() {
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'a matriz usa apenas prévia local')
  fs.mkdirSync(out,{recursive:true})
  const reportPath=path.join(out,'report.json')
  const writeReport=report=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2))
  const baseReport={state:'running',variants,required:required.length,totalPerVariant:cases.length}
  writeReport(baseReport)
  let browser, reports
  try {
    browser=await chromium.launch(launchOptions())
    reports=await Promise.all(variants.map(variant=>createSuite(browser,variant)))
  } catch (error) {
    writeReport({...baseReport,state:'setup-error',setupError:String(error?.message??error)})
    throw error
  } finally { if (browser) await browser.close() }
  const totals=reports.map(({width,theme,passed,total,required,missing,setupError})=>({width,theme,passed,total,required,missing,setupError}))
  const state=reports.every(row=>row.state==='passed')?'passed':'failed'
  writeReport({...baseReport,state,results:totals})
  console.log(JSON.stringify(totals,null,2))
  const problems=reports.flatMap(x=>x.setupError ? [`${x.width}/${x.theme} • prévia não inicializou: ${x.setupError}`]
    : x.results.filter(r=>!r.ok).map(r=>`${x.width}/${x.theme} • ${r.name} • passo ${r.stepIndex} • ${r.error}`))
  const gaps=totals.flatMap(x=>x.missing.map(id=>`${x.width}/${x.theme} • mapeamento sem caso aprovado: ${id}`))
  assert.equal(problems.length+gaps.length,0,[...problems,...gaps].join('\n'))
}
main().catch(err=>{console.error(err);process.exitCode=1})
