'use strict'

module.exports = class Token {
  constructor(dbToken, image) {
    this.dbToken = dbToken
    this.token = dbToken.text
    this.nTotal = dbToken.group.n
    this.nClinton = dbToken.group.nClinton
    this.nTrump = dbToken.group.nTrump
    this.image = image
  }

  sentenceText() {
    return this.dbToken.sentenceText()
  }
}
