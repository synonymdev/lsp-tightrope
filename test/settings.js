/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai')
const Settings = require('../src/util/settings')

const expect = chai.expect

describe('Settings', function () {
  const base = {
    a: 1,
    b: 2
  }

  it('should contain nothing by default', function () {
    const settings = new Settings()

    expect(settings.get('a')).to.not.exist
    expect(settings.get('b')).to.not.exist
  })

  it('can handle an ids not being an array', function () {
    const settings = new Settings(base, {})

    expect(settings.get('a')).to.equal(1)
    expect(settings.get('b')).to.equal(2)
  })

  it('can add multiple sets of settings', function () {
    const settings = new Settings(base)
    settings.addIdSettings({ id: 'test', b: 5 })
    settings.addIdSettings([{ id: 'more', b: 6 }])

    expect(settings.get('a')).to.equal(1)
    expect(settings.get('b')).to.equal(2)
    expect(settings.get('b', 'test')).to.equal(5)
    expect(settings.get('b', 'more')).to.equal(6)
    expect(settings.get('b', ['more', 'test'])).to.equal(5)
  })

  it('can handle an ids containing elements without an id', function () {
    const settings = new Settings(base, [
      { bad: 1 }, { id: 'test', b: 5 }, { a: 6, b: 7 }
    ])

    expect(settings.idSettings).to.deep.equal([{ id: 'test', b: 5 }])
    expect(settings.get('a')).to.equal(1)
    expect(settings.get('b')).to.equal(2)
    expect(settings.get('b', 'test')).to.equal(5)
  })

  it('should be able to access base settings', function () {
    const settings = new Settings(base)

    expect(settings.get('a')).to.equal(1)
    expect(settings.get('b')).to.equal(2)
    expect(settings.get('c')).to.not.exist
  })

  it('can override base settings', function () {
    const ids = [
      {
        id: 'test',
        b: 3
      }
    ]
    const settings = new Settings(base, ids)

    // A should always come back as 1
    expect(settings.get('a')).to.equal(1)
    expect(settings.get('a', 'wrong')).to.equal(1)
    expect(settings.get('a', 'test')).to.equal(1)
    expect(settings.get('a', ['test'])).to.equal(1)
    expect(settings.get('a', ['wrong', 'test'])).to.equal(1)

    // B should be 2 from the base setting, and 3 if the id of 'test' is given
    expect(settings.get('b')).to.equal(2)
    expect(settings.get('b', 'wrong')).to.equal(2)
    expect(settings.get('b', 'test')).to.equal(3)
    expect(settings.get('b', ['test'])).to.equal(3)
    expect(settings.get('b', ['test', 'wrong'])).to.equal(3)
  })

  it('can override multiple times', function () {
    const ids = [
      {
        id: 'magic',
        b: 3
      },
      {
        id: 'test',
        b: 4
      }
    ]
    const settings = new Settings(base, ids)

    // B should be 2 from the base setting, and 3 if the id of 'test' is given
    expect(settings.get('b')).to.equal(2)
    expect(settings.get('b', 'magic')).to.equal(3)
    expect(settings.get('b', 'test')).to.equal(4)
    expect(settings.get('b', ['test', 'magic'])).to.equal(3)
    expect(settings.get('b', ['magic', 'test'])).to.equal(4)
  })
})
