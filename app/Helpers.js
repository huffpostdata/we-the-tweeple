'use strict'

const PageContext = require('../generator/PageContext')
const renderVenn = require('../assets/javascripts/_venn')
const formatInt = require('../assets/javascripts/_format-int')
const htmlEscape = require('../assets/javascripts/_html-escape')

function extend_context(context, locals) {
  const new_locals = Object.assign({}, context.locals, locals)
  return new PageContext(context.compiler, new_locals)
}

class Helpers {
  constructor(context) {
    this.context = context
  }

  partial(name) {
    return this.context.render_template(name, this.context)
  }

  link_to(text, key, ...args) {
    return `<a href="${htmlEscape(this.context.path_to(key, ...args))}">${htmlEscape(text)}</a>`
  }

  link_to_asset(text, type, key, ...args) {
    return `<a href="${htmlEscape(this.context.path_to_asset(type, key, ...args))}">${htmlEscape(text)}</a>`
  }

  float_right_image(name, caption, options) {
    const context = extend_context(this.context, { name: name, caption: caption, options: options })
    return this.context.render_template('_float-right-image', context)
  }

  float_left_image(name, caption, options) {
    const context = extend_context(this.context, { name: name, caption: caption, options: options })
    return this.context.render_template('_float-left-image', context)
  }

  wide_image(name, caption, options) {
    const context = extend_context(this.context, { name: name, caption: caption, options: options })
    return this.context.render_template('_wide-image', context)
  }

  diptych_image(left_name, right_name, caption, options) {
    const context = extend_context(this.context, { left_name: left_name, right_name: right_name, caption: caption, options: options })
    return this.context.render_template('_diptych-image', context)
  }

  // Changes 'Written by [Adam Hooper]' to 'Written by <a href="..."></a>'
  format_authors(author) {
    function name_to_href(name) {
      // No idea if this permalinking function is correct.
      const slug = name.toLowerCase().replace(/[^\w]+/g, '-')
      return `//www.huffingtonpost.com/${slug}`
    }

    // Not HTML-safe. That should be fine.
    return author
      .replace(/\[([^\]]+)\]/g, (_, name) => `<a rel="author" href="${name_to_href(name)}">${name}</a>`)
  }

  term(text) {
    return `<kbd>${text}</kbd>` // assume no HTML characters
  }

  term_table(options) {
    const title = options.title
    if (!title) throw new Error(`Expected term_table() options to include "title": ${JSON.stringify(options)}`)

    const lookupToken = (term) => {
      const token = this.context.model.tokenDB.find(term)
      if (!token) throw new Error(`term_table() could not find token "${token}": ${JSON.stringify(options)}`)
      return token
    }

    const clintonTokens = (options.clinton || []).map(lookupToken)
    const trumpTokens = (options.trump || []).map(lookupToken)
    const allTokens = clintonTokens.concat(trumpTokens)

    const maxN = allTokens.reduce(((s, t) => Math.max(s, t.group.nClinton, t.group.nTrump)), 0)

    function prepareToken(token) {
      const g = token.group
      return {
        text: token.text,
        nClinton: formatInt(g.nClinton),
        nTrump: formatInt(g.nTrump),
        vennSvg: renderVenn(maxN, token).svg
      }
    }

    const data = {
      title: title,
      clinton: clintonTokens.map(prepareToken),
      trump: trumpTokens.map(prepareToken),
      nMax: formatInt(maxN),
      nQuarter: formatInt(Math.round(maxN / 4))
    }
    return this.context.render_template('_term-table', data)
  }

  vennHtml(term) {
    const token = this.context.model.tokenDB.find(term)
    if (!token) throw new Error(`venn_html() could not find token "${term}"`)

    const group = token.group

    const maxN = Math.max(group.nClinton, group.nTrump)

    return `<div class="venn-container-outer">${renderVenn(maxN, token).html}</div>`
  }

  termCount(term, person) {
    const token = this.context.model.tokenDB.find(term)
    if (!token) throw new Error(`termCount() could not find token "${term}"`)

    const group = token.group
    return formatInt(group['n' + person[0].toUpperCase() + person.slice(1)])
  }

  clickPrompt(text) {
    return `<p class="click-prompt"><span>${htmlEscape(text)}</span></p>`
  }
}

module.exports = Helpers
