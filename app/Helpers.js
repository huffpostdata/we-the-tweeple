'use strict'

const PageContext = require('../generator/PageContext')

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

}

module.exports = Helpers
