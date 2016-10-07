#!/usr/bin/env node

'use strict'

const fs = require('fs')

const TokenRenderer = require('../app/TokenRenderer')
const Database = require('../assets/javascripts/_database')

const database = new Database(fs.readFileSync(`${__dirname}/../assets/data/clinton-trump-token-counts-truncated.tsv`, 'utf-8'))
const tokens = database.tokens
const tokenRenderer = new TokenRenderer()

const Skip = 500

let n = 0

for (let i = 0; i < tokens.length; i += Skip) {
  n += 1
  const token = tokens[i]
  const group = token.group

  tokenRenderer.renderPng(token.text, group.n, group.nClinton, group.nTrump)
}

console.log(`Rendered ${n} images`)
