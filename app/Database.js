'use strict'

const fs = require('fs-extra')
const read_config = require('../generator/read_config')
const GoogleSheets = require('../generator/GoogleSheets')
const _ = require('lodash')

const TokenFactory = require('./TokenFactory')

const dataFile = './assets/data/clinton-trump-token-counts-truncated.tsv';

module.exports = class Database {
  constructor() {
    const base_meta = read_config('base-meta')
    const google_sheets = new GoogleSheets(read_config('google-sheets'))

    this.index = {
      meta: base_meta,
      page_html: 'Here is the HTML'
    }

    const f = new TokenFactory();

    const tsv = fs.readFileSync(dataFile, 'utf8');

    this.biggestTokens = _.chain(tsv)
    .split('\n')
    .reduce((tokens, row) => {
      row = row.split('\t');

      if (row.length === 4) {
        const clinton = parseInt(row[0]);
        const trump = parseInt(row[1]);

        tokens.push([
          clinton + trump,
          clinton,
          trump,
        ]);
      } else if (_.last(tokens).length === 3) {
        _.last(tokens).splice(0, 0, row[1]);
      }

      return tokens;
    }, [])
    .orderBy(['1'], ['desc'])
    .slice(0, 10000)
    .map((row) => {
      return f.build.apply(f, row);
    })
    .value();
  }
}
