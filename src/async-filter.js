
/**
 * async friendly array filter.
 * Wait for predicates to resolve, then does the real filter
 * asyncFilter(array, callback)
 * @param {*} arr
 * @param {*} predicate
 * @returns
 */
module.exports = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate))

  return arr.filter((_v, index) => results[index])
}
