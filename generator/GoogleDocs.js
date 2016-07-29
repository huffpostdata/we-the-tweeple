'use strict'

const fs = require('fs')
const yaml = require('js-yaml')

const Escapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}
const EscapeRegex = new RegExp(`([${Object.keys(Escapes).join('')}])`, 'g')

function escape_html(html) {
  return html.replace(EscapeRegex, (c) => Escapes[c])
}

// Downloads Google Docs documents and writes them as abstract syntax trees to
// the repository.
class GoogleDocs {
  constructor(config) {
    this.config = config
    this.cache = new Map()
  }

  // Turns a Google Doc into HTML
  render(slug, page_context) {
    const ast = this.slug_to_ast(slug)

    return ast
      .map((block) => {
        switch (block.type) {
          case 'p':
            if (block.texts.length === 1 && block.texts[0].underline) {
              // the paragraph is nothing but code. This is block-level code.
              return this.render_code(block.texts[0].text, page_context)
            } else {
              // fall through
            }
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
            return `<${block.type}>${this.render_texts(block.texts, page_context)}</${block.type}>`
          case 'hr':
          case 'page-break':
            return '<hr>'
          case 'ol':
          case 'ul':
            return `<${block.type}>${this.render_lis(block.blocks, page_context)}</${block.type}>`
          default:
            throw new Error(`Unhandled block type ${block.type}. Maybe add support for this type?`)
        }
      })
      .join('')
  }

  render_lis(lis, page_context) {
    return lis
      .map((li) => `<li>${this.render_texts(li.texts)}</li>`)
      .join('')
  }

  render_texts(texts, page_context) {
    return texts
      .map((text) => {
        if (text.underline) {
          return this.render_code(text.text, page_context)
        } else {
          const html = escape_html(text.text)

          if (text.bold) {
            return `<strong>${html}</strong>`
          } else if (text.italic) {
            return `<em>${html}</em>`
          } else if (text.href) {
            const href = escape_html(text.href)
            return `<a href="${href}">${html}</a>`
          } else {
            return html
          }
        }
      })
      .join('')
  }

  // HuffPost code syntax: it's just like JavaScript, but we allow backticks
  // instead of quotes. (That's because Google Docs likes to turn quotes into
  // smart quotes.) Also, we don't allow code: it's really syntactic sugar
  // around JSON.
  //
  // Want a backtick in a string? Too bad -- build a new syntax.
  render_code(marked_up_code, page_context) {
    const code = marked_up_code
      .replace(/"/g, '\\"')
      .replace(/`/g, '"')

    // render('foo', 'bar') --> ('render', [ 'foo', 'bar' ])
    const m = /^([^(]+)\((.*)\)/.exec(code)
    if (!m) throw new Error(`Invalid syntax ${code}. Maybe fix the Google Doc and 'npm run update-google-docs'?`)
    const method = m[1]
    const args_json = `[${m[2]}]`

    let args
    try {
      // We parse as YAML, not JSON. That parses something like "{ foo: 'bar' }"
      // ... which looks more like JavaScript.
      args = yaml.load(args_json)
    } catch (e) {
      throw new Error(`Could not parse ${args_json} as YAML: ${e}. Maybe fix the Google Doc and 'npm run update-google-docs'?`)
    }

    if (!page_context.helpers[method]) {
      throw new Error(`Invalid method ${method} in the Google Doc. Maybe code it? Or maybe fix the Google Doc and 'npm run update-google-docs'?`)
    }

    return page_context.helpers[method].apply(page_context.helpers, args)
  }

  slug_to_ast(slug) {
    if (!this.cache.has(slug)) {
      const input_path = `${this.config.code_path}/${slug}.json`
      const json = fs.readFileSync(input_path)
      const ast = JSON.parse(json)
      this.cache.set(slug, ast)
    }

    return this.cache.get(slug)
  }

  download_all_sync() {
    // We run this on dev, not production, so require() within dev alone so that
    // we don't need to install the module on production.
    const gdm = require('google-docs-markup')
    const sync_request = require('sync-request')

    for (const doc of this.config.docs) {
      const res = sync_request('GET', doc.url)
      const html = res.getBody()
      const ast = gdm.parse_google_docs_html(html)

      // Our docs have a page of instructions at the top. Skip until the first
      // page break.
      const useful_ast = ast.slice(ast.findIndex((b) => b.type == 'page-break') + 1)

      const output_path = `${this.config.code_path}/${doc.slug}.json`
      console.log(`GET ${doc.url} => ${output_path} (${useful_ast.length} paragraphs)`)
      fs.writeFileSync(output_path, JSON.stringify(useful_ast))
    }
  }
}

module.exports = GoogleDocs

if (require.main === module) {
  const read_config = require('./read_config')
  const config = read_config('google-docs')
  const google_docs = new GoogleDocs(config)
  google_docs.download_all_sync()
}
