'use strict'

// Set FONTCONFIG_PATH so we look for _our_ fonts, not system fonts
// (on production, there _are_ no system fonts)
const path = require('path');
process.env.FONTCONFIG_PATH = path.resolve(__dirname, '../raw-assets/fonts');

const fs = require('fs');
const os = require('os');
const Canvas = require('canvas');
const jpeg = require('jpeg-turbo')

const formatInt = require('../assets/javascripts/_format-int')
const renderVenn = require('../assets/javascripts/_venn')

const titleLine1 = 175;
const titleLine2 = titleLine1 + 90;
const countLine = 885;
const markerWidthAdd = 20;
const markerHeightAdd = 30;

function drawIntersection(ctx, xMid, yMid, mult, m) {
  ctx.beginPath()

  if (m.a === 0) {
    // No overlap. Render nothing.
  } else if (m.y === m.clinton.r) {
    // Circle: Trump around Clinton
    ctx.arc(
      xMid + mult * m.clinton.x, yMid,
      mult * m.clinton.r,
      0, 2 * Math.PI
    )
  } else if (m.y === m.trump.r) {
    // Circle: Clinton around Trump
    ctx.arc(
      xMid + mult * m.trump.x, yMid,
      mult * m.trump.r,
      0, 2 * Math.PI
    )
  } else {
    let thetaClinton = Math.asin(m.y / m.clinton.r)
    let thetaTrump = Math.asin(m.y / m.trump.r)

    if (m.x > 0) {
      thetaTrump = Math.PI - thetaTrump
    }

    if (m.x < 0) {
      thetaClinton = Math.PI - thetaClinton
    }

    ctx.arc(
      xMid + mult * (m.trump.x), yMid,
      mult * m.trump.r,
      Math.PI - thetaTrump, Math.PI + thetaTrump
    )
    ctx.arc(
      xMid - mult * (m.clinton.x), yMid,
      mult * m.clinton.r,
      -thetaClinton, thetaClinton
    )
  }

  ctx.closePath()
}

module.exports = class TokenRenderer {
  constructor() {
    const bg = new Canvas.Image()
    bg.src = fs.readFileSync('./raw-assets/share-card-base.png')

    this.width = bg.width
    this.height = bg.height

    this.canvas = new Canvas(this.width, this.height)
    this.ctx = this.canvas.getContext('2d')
    this.ctx.drawImage(bg, 0, 0, this.width, this.height)

    this.baseImageData = this.ctx.getImageData(0, 0, this.width, this.height)
  }

  /**
   * Creates a Buffer with image data.
   */
  renderImage(token) {
    const canvas = this.canvas
    const ctx = this.ctx

    const group = token.group
    const maxFontSize = 60

    ctx.putImageData(this.baseImageData, 0, 0)

    ctx._setFont('900', 'normal', maxFontSize, 'pt', 'Proxima Nova Condensed')
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    // Start with LRM (\u200e) so RTL text (e.g., "ابو") is at the left
    const longText = `\u200e“${token.text}” in their Twitter bios`
    const maxTextWidth = this.width * 0.7 // If we get too long, we'll make text shorter
    ctx.textBaseline = 'top'
    const measurements = ctx.measureText(longText)
    const ratio = maxTextWidth / measurements.width
    if (ratio < 1) {
      ctx._setFont('900', 'normal', maxFontSize * ratio, 'pt', 'Proxima Nova Condensed')
    }

    // Fiddle constantly with baseline. Arabic text's baseline is above most
    // of each character so if we tried to render "middle" that would be icky.
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${formatInt(group.n)} followers used`, this.width * 0.5, 94);
    ctx.textBaseline = 'top'
    ctx.fillText(longText, this.width * 0.5, 114 + measurements.actualBoundingBoxAscent);

    ctx._setFont('normal', 'normal', 24, 'pt', 'Arial')
    ctx.textBaseline = 'middle' // From now on, we're ASCII

    const venn = renderVenn(Math.max(group.nClinton, group.nTrump), token)
    const m = venn.measurements // 4 units wide, 2 units tall, center is 0,0

    const mult = 225 // ~1000 units wide, ~500 units tall
    const xMid = this.width / 2 - 10 // pic sizes are skewed
    const yMid = this.height / 2 + 80

    // Clinton circle
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 16 // half will be overwritten by ctx.fill()
    ctx.beginPath()
    ctx.arc(xMid - mult * m.clinton.x, yMid, mult * m.clinton.r, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.stroke() // border
    // copy-pasted...
    ctx.fillStyle = '#4c7de0'
    ctx.beginPath()
    ctx.arc(xMid - mult * m.clinton.x, yMid, mult * m.clinton.r, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.fill() // circle

    // Trump circle
    ctx.fillStyle = '#e52426'
    ctx.beginPath()
    ctx.arc(xMid + mult * m.trump.x, yMid, mult * m.trump.r, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.stroke() // border
    ctx.beginPath()
    ctx.arc(xMid + mult * m.trump.x, yMid, mult * m.trump.r, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.fill() // circle

    // "Both" shape
    // 1. "Both" outline (white):
    ctx.strokeStyle = 'white'
    drawIntersection(ctx, xMid, yMid, mult, m)
    ctx.stroke() // border
    ctx.fillStyle = '#9959ba'
    drawIntersection(ctx, xMid, yMid, mult, m)
    ctx.fill() // shape

    const margin = 15

    // Clinton label
    const xClinton = xMid - margin - mult * (m.clinton.x + m.clinton.r)
    ctx._setFont('900', 'normal', 45, 'pt', 'Proxima Nova Condensed')
    ctx.textAlign = 'right'
    ctx.fillStyle = '#4c7de0'
    ctx.fillText(formatInt(group.nClinton), xClinton, yMid - 50)
    ctx._setFont('normal', 'normal', 45, 'pt', 'Arial')
    ctx.fillText('follow only', xClinton, yMid)
    ctx.fillText('Clinton', xClinton, yMid + 50)

    // Trump label
    const xTrump = xMid + margin + mult * (m.trump.x + m.trump.r)
    ctx._setFont('900', 'normal', 45, 'pt', 'Proxima Nova Condensed')
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e52426'
    ctx.fillText(formatInt(group.nTrump), xTrump, yMid - 50)
    ctx._setFont('normal', 'normal', 45, 'pt', 'Arial')
    ctx.fillText('follow only', xTrump, yMid)
    ctx.fillText('Trump', xTrump, yMid + 50)

    // Both label
    const xBoth = xMid + mult * Math.min(Math.max(-m.clinton.x, m.x), m.trump.x)
    const yBoth = yMid + mult * Math.max(m.clinton.r, m.trump.r)
    ctx._setFont('900', 'normal', 45, 'pt', 'Proxima Nova Condensed')
    ctx.textAlign = 'center'
    ctx.fillStyle = '#9959ba'
    ctx.fillText(formatInt(group.nTrump), xBoth, yBoth + 70)
    ctx._setFont('normal', 'normal', 45, 'pt', 'Arial')
    ctx.fillText('follow both', xBoth, yBoth + 120)

    // Both _line_
    const yBothLine = yMid + mult * (m.x === 0 ? m.y : Math.min(m.clinton.r, m.trump.r))
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(xBoth, yBoth + 40)
    ctx.lineTo(xBoth, yBothLine + 8)
    ctx.stroke()

    if (canvas.stride != canvas.width * 4) throw new Error("We don't support stride != 4*width")
    const buf = canvas.toBuffer('raw')
    return jpeg.compressSync(buf, {
      format: os.endianness() == 'LE' ? jpeg.FORMAT_BGRA : jpeg.FORMAT_ARGB,
      width: canvas.width,
      height: canvas.height,
      quality: 90 // text deserves quality. It doesn't affect speed too much
    })
  }
}
