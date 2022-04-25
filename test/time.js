/* eslint-disable no-undef */
const assert = require('assert')
const timeToMilliseconds = require('../src/util/time-to-milliseconds')

describe('Time mapping', function () {
  it('should be convert valid time strings into milliseconds', function () {
    assert.equal(timeToMilliseconds('1'), 1)
    assert.equal(timeToMilliseconds('100'), 100)
    assert.equal(timeToMilliseconds('100.5'), 100)

    assert.equal(timeToMilliseconds('100s'), 100000)
    assert.equal(timeToMilliseconds('1234s'), 1234000)

    assert.equal(timeToMilliseconds('1m'), 60000)
    assert.equal(timeToMilliseconds('0.5m'), 30000)

    assert.equal(timeToMilliseconds('0.5h'), 30 * 60 * 1000)
    assert.equal(timeToMilliseconds('4h'), 4 * 60 * 60 * 1000)

    assert.equal(timeToMilliseconds('1d'), 24 * 60 * 60 * 1000)
  })

  it('gives 0 for bad input', function () {
    assert.equal(timeToMilliseconds('car'), 0)
    assert.equal(timeToMilliseconds('-100'), 0)
    assert.equal(timeToMilliseconds('1t'), 0)
    assert.equal(timeToMilliseconds('1.1.2s'), 0)
  })
})
