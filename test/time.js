/* eslint-disable no-undef */
const assert = require('assert')
const time = require('../src/util/time-to-milliseconds')

describe('Time mapping', function () {
  it('should be convert valid time strings into milliseconds', function () {
    assert.equal(time('1'), 1)
    assert.equal(time('100'), 100)
    assert.equal(time('100.5'), 100)

    assert.equal(time('100s'), 100000)
    assert.equal(time('1234s'), 1234000)

    assert.equal(time('1m'), 60000)
    assert.equal(time('0.5m'), 30000)

    assert.equal(time('0.5h'), 30 * 60 * 1000)
    assert.equal(time('4h'), 4 * 60 * 60 * 1000)

    assert.equal(time('1d'), 24 * 60 * 60 * 1000)
  })

  it('gives 0 for bad input', function () {
    assert.equal(time('car'), 0)
    assert.equal(time('-100'), 0)
    assert.equal(time('1t'), 0)
    assert.equal(time('1.1.2s'), 0)
  })
})
