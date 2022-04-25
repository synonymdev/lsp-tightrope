// Time format
// Examples: 12 -> 12, 12s -> 12000, 12m -> 720000
const regex = /^(([0-9]*[.])?[0-9]+)(d|h|m|s)?$/

function _unitsMultiple (unit) {
  if (unit === 's') return 1000
  if (unit === 'm') return 60 * 1000
  if (unit === 'h') return 60 * 60 * 1000
  if (unit === 'd') return 24 * 60 * 60 * 1000

  return 1
}

/**
 * given a time and unit, return milliseconds
 * @param {*} t
 * @param {*} unit
 * @returns
 */
function _delayByUnit (t, unit) {
  return t * _unitsMultiple(unit)
}

/**
 * Converts a time string (12, 12s, 12h, 12m) to an int number of milliseconds
 * postfix with s for seconds, m for minutes, h for hours or d for days
 * Examples:
 * "1234" -> 1234 ms
 * "1s" -> 1000 ms
 * "5m" -> 300,000 ms
 * @param time - string of the duration, such as "24h" for 24 hours
 * @returns {number}
 */
module.exports = (time) => {
  const m = regex.exec(time)
  if (m === null) return 0

  const delay = Math.max(parseFloat(m[1]), 0)
  return Math.floor(_delayByUnit(delay, m[3]))
}
