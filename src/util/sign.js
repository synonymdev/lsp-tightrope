const crypto = require('crypto')

/**
 * Forces the name/values pairs into alphabetical order and creates a query string style string to sign
 * @param {*} params
 * @returns
 */
function _paramsToStringToSign (params) {
  return Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
}

/**
 * Generates the signatures from a string
 * @param {*} secret
 * @param {*} message
 * @returns
 */
function _signMessage (secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

/**
 * Sign a message
 * @param {*} secret - secret to sign with
 * @param {*} timestamp - timestamp in ms
 * @param {*} params - name / value pairs
 * @returns
 */
module.exports = (secret, timestamp, publicKey, params = {}) => {
  const toSign = { ...params, timestamp, publicKey }
  return _signMessage(secret, _paramsToStringToSign(toSign))
}
