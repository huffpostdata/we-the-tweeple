'use strict'

const fs = require('fs')
const read_config = require('../generator/read_config')
const GoogleSheets = require('../generator/GoogleSheets')

const TokenFactory = require('./TokenFactory')

module.exports = class Database {
  constructor() {
    const base_meta = read_config('base-meta')
    const google_sheets = new GoogleSheets(read_config('google-sheets'))

    this.index = {
      meta: base_meta,
      page_html: 'Here is the HTML'
    }

    const f = new TokenFactory()

    this.biggestTokens = [
      f.build('Adam', 240, 100, 200),
      f.build('Continues', 305, 300, 10),
      f.build('Foobar', 200100, 10000, 200000),
      f.build('love/hate', 200, 1, 200)
    ]
  }
}
