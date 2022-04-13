/* eslint-disable no-undef */
const assert = require('assert')
const signMessage = require('../src/util/sign')

describe('Sign Messages', function () {
  it('should be able to sign messages', function () {
    const ts = 1648741762439
    const remotePeer = '5rRSNhSbbffXYW6uh9XmzH7CVkeWzzKUSfN4NAC4ojbf'
    assert.equal(signMessage('secret', ts, remotePeer, {}), 'c3dfb60ae5688a56c637081659968910ff975d76545382b77d0053c5497b3d72')
    assert.equal(signMessage('secret', ts, remotePeer), 'c3dfb60ae5688a56c637081659968910ff975d76545382b77d0053c5497b3d72')
    assert.equal(signMessage('secret', ts, remotePeer, { test: 'bob' }), 'c0772207f745250f82b0afe0d215fb0b1b57e0accf143080831f81cec0249e33')
    assert.equal(signMessage('secret', ts, remotePeer, { test: 'bob', abc: 123.4 }), 'b9251a24783fe114d5086aab709448e1d557ca6d241facf5da27c95597da140b')
  })
})
