var header = document.querySelector('header');

function makeHeaderInteractive(utfgrid, clickFunc) {
  var grid = utfgrid.grid;
  var width = grid[0].length;
  var height = grid.length;

  var canvas = document.createElement('canvas');
  canvas.classList.add('interaction');
  header.querySelector('figure').appendChild(canvas);

  var ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  var charToImageData = {}; // cache
  var currentChar = ' ';

  function evToChar(ev) {
    var x = Math.round(ev.offsetX / ev.target.offsetWidth * width);
    var y = Math.round(ev.offsetY / ev.target.offsetHeight * height);

    if (x < 0) x = 0;
    if (x >= width) x = width - 1;
    if (y < 0) y = 0;
    if (y >= height) y = height - 1;
    return grid[y][x];
  }

  function buildCharImageData(c) {
    var imageData = ctx.createImageData(width, height);
    var d = imageData.data;
    for (var y = 0; y < height; y++) {
      var row = grid[y];
      for (var x = 0; x < width; x++) {
        if (row.charAt(x) === c) {
          var pos = 4 * (y * width + x);
          d[pos + 0] = 0xff; // R
          d[pos + 1] = 0xff; // G
          d[pos + 2] = 0xff; // B
          d[pos + 3] = 0xff; // A
        }
      }
    }
    return imageData;
  }

  function charToToken(c) {
    var index = c.codePointAt(0);
    if (index >= 93) index -= 1;
    if (index >= 35) index -= 1;
    index -= 32;
    return utfgrid.keys[index];
  }

  function highlightChar(c) {
    if (!charToImageData.hasOwnProperty(c)) {
      charToImageData[c] = buildCharImageData(c);
    }

    ctx.clearRect(0, 0, width, height);

    if (c !== ' ') {
      var imageData = charToImageData[c];
      ctx.putImageData(imageData, 0, 0);
      canvas.classList.add('highlight');
    } else {
      canvas.classList.remove('highlight');
    }
  }

  function maybeHover(ev) {
    const c = evToChar(ev);
    highlightChar(c);
  }

  function maybeSearch(ev) {
    const c = evToChar(ev);
    if (c !== ' ') {
      const token = charToToken(c);
      clickFunc(token);
    }
  }

  header.addEventListener('mousemove', maybeHover);
  header.addEventListener('click', maybeSearch);
}

/**
 * Makes the birds in the header highlight on mouse move. And when you click,
 * we call clickFunc() with the token text they're holding.
 */
module.exports = function init(clickFunc) {
  var xhr = new XMLHttpRequest()
  xhr.open('GET', header.getAttribute('data-interaction-grid-path'))
  xhr.responseType = 'json'

  xhr.ontimeout = xhr.onerror = xhr.onabort = function() {
    console.warn('Could not load data for header interactions', xhr);
  };

  xhr.onload = function() {
    if (xhr.status !== 200 && xhr.status !== 304) {
      console.warn('Invalid status code from server for header interactions', xhr.status, xhr)
    } else {
      makeHeaderInteractive(xhr.response, clickFunc)
    }
  };

  xhr.send();
};
