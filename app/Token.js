module.exports = class Token {
  constructor(token, nTotal, nClinton, nTrump, tokenRenderer) {
    this.token = token
    this.nTotal = nTotal
    this.nClinton = nClinton
    this.nTrump = nTrump
    this.tokenRenderer = tokenRenderer
  }

  renderPng(loc) {
    return this.tokenRenderer.renderPng(
      this.token,
      this.nTotal,
      this.nClinton,
      this.nTrump,
      loc
    )
  }
}
