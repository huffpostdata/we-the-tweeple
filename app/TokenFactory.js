'use strict'

const Token = require('./Token')
const TokenRenderer = require('./TokenRenderer')

module.exports = class TokenFactory {
  constructor() {
    this.tokenRenderer = new TokenRenderer()
  }

  build(token, nTotal, nClinton, nTrump) {
    const png = this.tokenRenderer.renderPng(token, nTotal, nClinton, nTrump)
    return new Token(token, nTotal, nClinton, nTrump, png)
  }
}
