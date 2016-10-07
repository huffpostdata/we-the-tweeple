'use strict'

const fs = require('fs')
const read_config = require('../generator/read_config')

const GoogleDocs = require('../generator/GoogleDocs')
const TokenDB = require('../assets/javascripts/_database')
const Token = require('./Token')
const TokenRenderer = require('./TokenRenderer')

module.exports = class Database {
  constructor() {
    const google_docs = new GoogleDocs(read_config('google-docs'))

    const tsv = fs.readFileSync(`${__dirname}/../assets/data/clinton-trump-token-counts-truncated.tsv`, 'utf-8')
    const tokenDB = new TokenDB(tsv)
    const tokenRenderer = new TokenRenderer()

    this.index = google_docs.load('index')
    this.index.tokenDB = tokenDB

    this.tokens = [
      'Adam', 'continue', 'Trump', '#MAGA'
    ].map(term => {
      const token = tokenDB.find(term)
      const g = token.group
      const png = tokenRenderer.renderPng(token.text, g.n, g.nClinton, g.nTrump)
      const ret = new Token(token.text, g.n, g.nClinton, g.nTrump, png)
      return ret
    })
  }
}
