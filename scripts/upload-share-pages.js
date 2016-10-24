#!/usr/bin/env node

'use strict'

const fs = require('fs')
const marko = require('marko')

const AWS = require('../generator/AWS')
const TokenRenderer = require('../app/TokenRenderer')
const Database = require('../assets/javascripts/_database')
const read_config = require('../generator/read_config')

const database = new Database()
database.addPartialTxt(fs.readFileSync(`${__dirname}/../assets/data/group-tokens.txt`, 'utf-8'), true)
const tokenRenderer = new TokenRenderer()

const appConfig = read_config('app')
const pageConfig = read_config('pages')
const template = marko.load('views/share-page.marko')
const aws = new AWS(read_config('aws'))

const tokensToUpload = database.tokens.slice()
const nTokens = tokensToUpload.length

const NGreenlets = 20

if (!process.env.BASE_URL) {
  throw new Error(`You must set a BASE_URL environment variable`)
}
if (!process.env.S3_BUCKET) {
  throw new Error(`You must set an S3_BUCKET environment variable`)
}

const BaseUrl = process.env.BASE_URL

function path_to(key, tokenOrNull) {
  switch (key) {
    case 'index': return appConfig.base_path
    case 'share-image': return `${appConfig.base_path}/share/${encodeURIComponent(tokenOrNull)}.jpg?3`
    case 'share-page': return `${appConfig.base_path}/${encodeURIComponent(tokenOrNull)}`
    default: throw new Error(`Our path_to() stub cannot handle the key: ${key}`)
  }
}

function url_to(key, tokenOrNull) {
  return `${BaseUrl}${path_to(key, tokenOrNull)}`
}

/**
 * Retries an upload infinitely.
 */
function uploadUntilSuccess(childNum, key, page, callback) {
  let tryNum = 0

  function tryOnce() {
    tryNum += 1
    if (tryNum > 1) {
      console.log(`[${childNum}] try ${tryNum}...`)
    }

    aws.upload_page(key, page)
      .then(callback, (err) => {
        console.warn(`[${childNum}] ${err.stack}`)
        process.nextTick(tryOnce)
      })
  }

  tryOnce()
}

/**
 * Runs a "greenlet" -- uploads on a loop until tokenToUpload is empty.
 *
 * Run many at a time to use more bandwidth. (Bandwidth is the bottleneck.)
 */
function spawn(i) {
  function runOneToken(callback) {
    if (tokensToUpload.length === 0) return; // "greenlet" dies

    const token = tokensToUpload.shift()
    const tokenNum = nTokens - tokensToUpload.length
    const group = token.group

    console.log(`[${i}] Uploading token ${tokenNum}/${nTokens}: ${token.text}...`)
    const html = template.renderSync({
      path_to: path_to,
      url_to: url_to,
      model: {
        token: token.text,
        sentenceText: () => token.sentenceText()
      }
    })

    const page = {
      body: html,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }

    const jpg = {
      body: tokenRenderer.renderImage(token),
      headers: {
        'Content-Type': 'image/jpeg'
      }
    }

    // Nasty URLs: AWS doesn't let us URLEncode stuff, because "%" is a special
    // character for AWS. So we suffer: upload special characters as-is; when
    // linking to pages, do all the URLEncoding we want; AWS URLDecodes all URLs
    // before serving them.
    uploadUntilSuccess(i, `${appConfig.base_path}/share/${token.text}.jpg`, jpg, () => {
      uploadUntilSuccess(i, `${appConfig.base_path}/${token.text}`, page, () => {
        process.nextTick(runOneToken)
      })
    })
  }

  runOneToken()
}

for (let i = 0; i < NGreenlets; i++) {
  spawn(i);
}
