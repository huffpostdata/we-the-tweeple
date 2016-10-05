'use strict'

const AssetCompiler = require('./AssetCompiler')
const PageCompiler = require('./PageCompiler')
const read_config = require('./read_config')

// Seeing this symbol somewhere? You should edit config/app.yml to
// create a helper class.
class ThereAreNoHelpers_EditConfigAppYmlToDefineThem {
  constructor() {}
}

class App {
  constructor(config) {
    this.config = config
  }

  _build_with_asset_compiler(asset_compiler) {
    const database = this.load_database()

    let helpers_ctor
    if (this.config.helpers) {
      helpers_ctor = require(`../${this.config.helpers}`)
    } else {
      helpers_ctor = ThereAreNoHelpers_EditConfigAppYmlToDefineThem
    }

    const page_config = read_config('pages')
    const page_compiler = new PageCompiler(
      page_config,
      this.config.base_path,
      process.env.BASE_URL || this.config.base_url,
      asset_compiler,
      database,
      helpers_ctor
    )
    page_compiler.render_all()

    const output = { assets: {}, pages: {} }

    for (const type of Object.keys(asset_compiler.assets)) {
      for (const key of Object.keys(asset_compiler.assets[type])) {
        const asset = asset_compiler.assets[type][key]
        output.assets[`${this.config.base_path}/${asset.path}`] = asset
      }
    }
    for (const key of Object.keys(page_compiler.output)) {
      output.pages[`${key}`] = page_compiler.output[key]
    }

    return output
  }

  build(callback) {
    const asset_config = read_config('assets')
    asset_config.base_path = this.config.base_path
    const asset_compiler = new AssetCompiler(asset_config)

    asset_compiler.build_all((err) => {
      if (err !== null) return callback(err)
      try {
        return callback(null, this._build_with_asset_compiler(asset_compiler))
      } catch (e) {
        return callback(e)
      }
    })
  }

  load_database() {
    const Database = require('../app/Database')
    return new Database()
  }
}

class BuildOutput {
  constructor(assets, pages, error) {
    this.assets = assets
    this.pages = pages
    this.error = error
  }

  get(key) {
    if (this.assets[key]) {
      const asset = this.assets[key]

      return {
        body: asset.data,
        headers: {
          'Content-Type': asset.content_type,
          'Cache-Control': `public, max-age=${asset.max_age / 1000}`,
          'ETag': 'this-file-should-never-change'
        }
      }
    } else if (this.pages[key]) {
      return this.pages[key]
    } else {
      return null
    }
  }
}

// Returns a BuildOutput
App.build_output_from_scratch = function(callback) {
  const t1 = new Date()
  const app_config = read_config('app')
  const app = new App(app_config)

  try { // build() still has synchronous code
    app.build((error, output) => {
      const t2 = new Date()
      console.log(`Rendered in ${t2-t1}ms`)
      if (error) {
        return callback(error)
      } else {
        return callback(null, new BuildOutput(output.assets, output.pages, null))
      }
    })
  } catch (err) {
    console.warn(err.stack)
    return callback(err)
  }
}

module.exports = App
