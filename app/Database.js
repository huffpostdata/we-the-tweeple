'use strict'

const fs = require('fs')
const read_config = require('../generator/read_config')

const GoogleDocs = require('../generator/GoogleDocs')
const TokenFactory = require('./TokenFactory')
const TokenDB = require('../assets/javascripts/_database')

module.exports = class Database {
  constructor() {
    const google_docs = new GoogleDocs(read_config('google-docs'))

    const tsv = fs.readFileSync(`${__dirname}/../assets/data/clinton-trump-token-counts-truncated.tsv`, 'utf-8')
    const tokenDB = new TokenDB(tsv)

    this.index = google_docs.load('index')
    this.index.tokenDB = tokenDB

    const f = new TokenFactory()

    this.tokens = [
      f.build('Adam', 240, 100, 200),
      f.build('continues', 305, 300, 10),
      f.build('Foobar', 200100, 10000, 200000),
      f.build('love/hate', 200, 1, 200)
    ]
  }
}
