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

    const tsv = fs.readFileSync(`${__dirname}/../assets/data/group-tokens.tsv`, 'utf-8')
    const tokenDB = new TokenDB(tsv)
    const tokenRenderer = new TokenRenderer()

    this.index = google_docs.load('index')
    this.index.tokenDB = tokenDB

    this.tokens = [
      '#MAGA', '#HillYes',                                   // nClinton=0, nTrump=0
      'ابو', 'générale', 'R&B/Soul', '読書', 'घर', 'Дизайн', // Unicode in header
      'RTs are not necessarily endorsements',                // Long string
      'Trump 2016', 'Clinton for President',                 // nBoth=~nClinton, nBoth=~nTrump
      'Adam',                                                // easy to remember ;)
      "my grandma"                                           // very wide
    ].map(term => {
      const token = tokenDB.find(term)
      const image = tokenRenderer.renderImage(token)
      const ret = new Token(token, image)
      return ret
    })
  }
}
