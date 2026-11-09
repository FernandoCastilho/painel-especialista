const assert = require('node:assert/strict')

// Assert the requested initial state, then open content as a reader would.
module.exports = async function openCallouts(page, labels = [/^Exemplo numérico/]) {
  const detail = page.locator('.learn-detail')
  assert.equal(await detail.locator('details[open]').count(), 0, 'concept callouts start collapsed')
  for (const label of labels) {
    const summary = detail.locator('summary').filter({ hasText: label })
    await summary.click()
    assert.equal(await summary.evaluate(el => el.parentElement.open), true)
  }
}
