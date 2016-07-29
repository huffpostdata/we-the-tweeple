'use strict'

const S3 = new (require('aws-sdk').S3)()
const read_config = require('./read_config')

class AWS {
  constructor(config) {
    this.config = config
  }

  // Returns a Promise
  upload_asset(key, asset) {
    const params = this.build_params({
      Key: key.substring(1),
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

  // Returns a Promise
  upload_page(key, page) {
    const max_age = 30000
    const params = this.build_params({
      Key: key.substring(1),
      Body: page,
      CacheControl: 'public, max-age=30',
      Expires: new Date(Date.now() + 30000),
      ContentType: 'text/html; charset=utf-8'
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
      CacheControl: `public, max-age=${max_age / 1000}`,
      Expires: new Date(Date.now() + max_age)
    }, params)
  }
}

AWS.upload_assets_and_pages = (assets, pages) => {
  const config = read_config('aws')
  const aws = new AWS(config)
  return aws.upload_assets_and_pages(assets, pages)
}

module.exports = AWS
