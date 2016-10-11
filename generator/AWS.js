'use strict'

const S3 = new (require('aws-sdk').S3)()
const read_config = require('./read_config')

/**
 * When the reader GETs from AWS and the URL contains '%XX', AWS will decode
 * the string _before_ fetching it.
 *
 * This seems like an obvious bug in AWS. All we can do is decode the string
 * before we upload it.
 *
 * An alternative approach: double-encode the key. That makes for some very
 * ugly URLs, though.
 */
function mangleKey(s) {
  // decodeURIComponent() throws on malformed URL. We'll assume AWS doesn't.
  return s
    // Decode ASCII values, such as "#"
    .replace(/%([0-7][0-9A-F])/g, (_, x) => String.fromCharCode(+('0x' + x)))

    // Sorry, we gotta do a full UTF-8 decoding for S3 here :(
    // Assume the input is valid UTF-8.
    // https://en.wikipedia.org/wiki/UTF-8#Description
    .replace(/%([C-D][0-9A-F])%([0-9A-F][0-9A-F])/g, (_, x1, x2) => {
      const c = ((+`0x${x1}` & 0b00011111) << 6) | ((+`0x${x2}` & 0b00111111))
      return String.fromCodePoint(c)
    })

    // 3-byte UTF-8
    .replace(/%(E[0-9A-F])%([0-9A-F]{2})%([0-9A-F]{2})/g, (_, x1, x2, x3) => {
      const c = (
        ((+`0x${x1}` & 0b00001111) << 12) |
        ((+`0x${x2}` & 0b00111111) << 6) |
        (+`0x${x3}` & 0b00111111)
      )
      return String.fromCodePoint(c)
    })

    // 4-byte UTF-8
    .replace(/%(F[0-9A-F])%([0-9A-F]{2})%([0-9A-F]{2})%([0-9A-F]{2})/g, (_, x1, x2, x3, x4) => {
      const c = (
        ((+`0x${x1}` & 0b00000111) << 18) |
        ((+`0x${x2}` & 0b00111111) << 12) |
        ((+`0x${x3}` & 0b00111111) << 6) |
        (+`0x${x4}` & 0b00111111)
      )
      return String.fromCodePoint(c)
    })
}

class AWS {
  constructor(config) {
    this.config = config
  }

  // Returns a Promise
  upload_asset(key, asset) {
    const params = this.build_params({
      Key: mangleKey(key.substring(1)),
      Body: asset.data,
      ContentType: asset.content_type
    }, asset.max_age)
    console.log(`PUT s3://${params.Bucket}/${params.Key} ${params.ContentType} ${asset.max_age}`)
    return S3.putObject(params).promise()
  }

  upload_assets(assets) {
    const keys = Object.keys(assets)
    return keys.reduce((p, key) => p.then(() => this.upload_asset(key, assets[key])), Promise.accept())
  }

  upload_redirect(key, path) {
    const max_age = 30000
    const params = this.build_params({
      Key: mangleKey(key.substring(1)),
      WebsiteRedirectLocation: path
    }, max_age)
    console.log(`PUT s3://${params.Bucket}/${params.Key} => ${path} ${max_age}`)
    return S3.putObject(params).promise()
  }

  // Returns a Promise
  upload_page(key, page) {
    if (page.hasOwnProperty('redirect')) return this.upload_redirect(key, page.redirect)

    const max_age = 30000
    const params = this.build_params({
      Key: mangleKey(key.substring(1)),
      Body: page.body,
      ContentType: page.headers['Content-Type']
    }, max_age)
    console.log(`PUT s3://${params.Bucket}/${params.Key} ${params.ContentType} ${max_age}`)
    return S3.putObject(params).promise()
  }

  upload_pages(pages) {
    const keys = Object.keys(pages)
    return keys.reduce((p, key) => p.then(() => this.upload_page(key, pages[key])), Promise.accept())
  }

  upload_assets_and_pages(assets, pages) {
    return this.upload_assets(assets).then(() => this.upload_pages(pages))
  }

  build_params(params, max_age) {
    return Object.assign({
      Bucket: process.env.S3_BUCKET || this.config.upload_to_s3_bucket,
      ACL: 'public-read',
      CacheControl: `public, max-age=${Math.round(max_age / 1000)}`
    }, params)
  }
}

AWS.upload_assets_and_pages = (assets, pages) => {
  const config = read_config('aws')
  const aws = new AWS(config)
  return aws.upload_assets_and_pages(assets, pages)
}

module.exports = AWS
