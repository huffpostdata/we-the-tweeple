'use strict'

const read_config = require('../generator/read_config')

const TokenFactory = require('./TokenFactory')

module.exports = class Database {
  constructor() {
    const base_meta = read_config('base-meta')

    this.index = {
      meta: base_meta,
      page_html: 'Here is the HTML'
    }

    const f = new TokenFactory();

    this.tokens = [
      f.build('Adam', 240, 100, 200),
      f.build('Continues', 305, 300, 10),
      f.build('Foobar', 200100, 10000, 200000),
      f.build('love/hate', 200, 1, 200)
    ]
  }
}
