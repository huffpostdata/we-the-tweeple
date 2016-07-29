'use strict'

const fs = require('fs')
const read_config = require('../generator/read_config')
const GoogleSheets = require('../generator/GoogleSheets')

module.exports = class Database {
  constructor() {
    const base_meta = read_config('base-meta')
    const google_sheets = new GoogleSheets(read_config('google-sheets'))

    this.index = {
      meta: base_meta,
      page_html: 'Here is the HTML'
    }
  }
}
