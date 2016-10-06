'use strict'

const PageContext = require('../generator/PageContext')
const venn = require('../assets/javascripts/_venn')
const formatInt = require('../assets/javascripts/_format-int')

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

    const maxN = allTokens.reduce(((s, t) => Math.max(s, t.groupN)), 0)

    function prepareToken(token) {
      const g = token.group
      return {
        text: token.text,
        nClinton: formatInt(g.nClinton),
        nTrump: formatInt(g.nTrump),
        vennSvg: venn(maxN, g.nClinton, g.nTrump, g.nBoth)
      }
    }

    const data = {
      title: title,
      clinton: clintonTokens.map(prepareToken),
      trump: trumpTokens.map(prepareToken)
    }
    return this.context.render_template('_term-table', data)
  }
}

module.exports = Helpers
