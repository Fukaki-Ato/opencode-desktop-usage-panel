const test = require('node:test')
const assert = require('node:assert/strict')
const make = require('./renderer.cjs')
const { metrics } = make({})

test('native V2 output and reasoning are separate, cache write is outside the hit denominator', () => {
  const result = metrics({ tokens: { input: 100, output: 20, reasoning: 10, cache: { read: 900, write: 50 } }, cost: 0 }, [])
  assert.equal(result.total, 1080)
  assert.equal(result.hit, 0.9)
  assert.equal(result.cost, 0)
  assert.equal(result.authoritative, true)
})

test('session totals do not depend on the loaded message window', () => {
  const result = metrics({ tokens: { input: 1000, output: 10, cache: { read: 9000, write: 0 } } }, [
    { type: 'assistant', id: 'm2', tokens: { input: 1, output: 1, cache: { read: 0 } } },
  ])
  assert.equal(result.total, 10010)
  assert.equal(result.rows.length, 1)
})

test('revert excludes later loaded rows and output never counts twice', () => {
  const result = metrics({ revert: { messageID: 'm2' } }, [
    { type: 'assistant', id: 'm2', tokens: { input: 1000 } },
    { type: 'assistant', id: 'm1', tokens: { input: 10, output: 5, reasoning: 2 } },
    { type: 'user', id: 'm0', tokens: { input: 100 } },
  ])
  assert.equal(result.total, 17)
  assert.equal(result.rows.length, 1)
  assert.equal(result.authoritative, false)
})

test('unavailable and malformed usage never renders NaN', () => {
  const result = metrics(undefined, [])
  assert.equal(result.hit, null)
  assert.equal(result.total, 0)
  assert.equal(result.cost, undefined)
  assert.equal(metrics({ tokens: { input: -1, output: NaN, cache: { read: Infinity } } }, []).total, 0)
})
