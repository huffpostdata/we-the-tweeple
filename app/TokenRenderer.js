// import

const path = require('path');

process.env['FONTCONFIG_PATH'] = path.resolve(__dirname, '../fonts');

const fs = require('fs-extra');
const Canvas = require('canvas');
const Image = Canvas.Image;

// vars

const imageWidth = 2000;
const imageHeight = 1000;
const titleLine1 = 175;
const titleLine2 = titleLine1 + 90;
const countLine = 885;
const markerWidthAdd = 20;
const markerHeightAdd = 30;

// fns

function addCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// export

module.exports = class TokenRenderer {
  constructor() {
    this.bg = new Image();
    this.bg.src = fs.readFileSync('./raw-assets/design.png');
  }

  /**
   * Creates a Buffer with PNG data, ready for streaming.
   */
  renderPng(token, nTotal, nClinton, nTrump) {
    const canvas = new Canvas(imageWidth, imageHeight);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(this.bg, 0, 0, imageWidth, imageHeight);

    ctx.font = '110pt BentonSans Regular';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';

    ctx.fillText(addCommas(nClinton), imageWidth * 0.25, countLine);
    ctx.fillText(addCommas(nTrump), imageWidth * 0.75, countLine);

    ctx.font = '600 55pt Poppins SemiBold';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const allMeas = ctx.measureText(token + ' in their bios?');
    const termMeas = ctx.measureText(token);

    ctx.rect(
      ((imageWidth - allMeas.width) / 2) - (markerWidthAdd / 2),
      titleLine2 - (markerHeightAdd * 0.666) - (termMeas.emHeightAscent / 2),
      termMeas.width + markerWidthAdd,
      termMeas.emHeightAscent + markerHeightAdd);
    ctx.fillStyle = 'rgb(255, 220, 1)';
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.fillText('How many Twitter followers say', imageHeight, titleLine1);
    ctx.fillText(token + ' in their bios?', imageHeight, titleLine2);

    return canvas.toBuffer();
  }
}
