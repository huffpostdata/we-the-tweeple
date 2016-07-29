'use strict'

const fs = require('fs')
const yaml = require('js-yaml')
const csv_parse = require('csv-parse/lib/sync')

class GoogleSheets {
  constructor(config) {
    this.config = config
    this.cache = new Map()
  }

  // Returns an Array of Objects for the given slug.
  //
  // You must have called download_all_sync() to get data for this method.
  slug_to_array(slug) {
    if (!this.cache.has(slug)) {
      const input_path = `${this.config.code_path}/${slug}.csv`
      const csv = fs.readFileSync(input_path)
      const array = csv_parse(csv, { columns: true })
      this.cache.set(slug, array)
    }

    return this.cache.get(slug)
  }

  // Turns a Google Sheets spreadsheet into a JSON object mapping sheet name to
  // an Array of Object values, one per row.
  download_all_sync() {
    const sync_request = require('sync-request')

    for (const sheet of this.config.sheets) {
      const res = sync_request('GET', sheet.url)
      const csv = res.getBody()
      const output_path = `${this.config.code_path}/${sheet.slug}.csv`
      console.log(`GET ${sheet.url} => ${output_path} (${csv.length}b)`)
      fs.writeFileSync(output_path, csv, { encoding: 'utf-8' })
    }
  }
}

module.exports = GoogleSheets

if (require.main === module) {
  const read_config = require('./read_config')
  const config = read_config('google-sheets')
  const google_sheets = new GoogleSheets(config)
  google_sheets.download_all_sync()
}
