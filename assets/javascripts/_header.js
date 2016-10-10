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

  var charToImageData = {}; // cache: { x, y, width, height, ImageData }
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
    // 1. Find bounds. (these are many-megabyte imates)
    var xMin = width, xMax = 0, yMin = height, yMax = 0;

    for (var y = 0; y < height; y++) {
      var row = grid[y];
      for (var x = 0; x < width; x++) {
        if (row.charAt(x) === c) {
          if (x < xMin) xMin = x;
          if (x > xMax) xMax = x;
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        }
      }
    }

    // 2. Build ImageData
    var imageData = ctx.createImageData(xMax - xMin + 1, yMax - yMin + 1);
    var d = imageData.data;
    for (var y = yMin; y <= yMax; y++) {
      var row = grid[y];
      for (var x = xMin; x < xMax; x++) {
        if (row.charAt(x) === c) {
          var pos = 4 * ((y - yMin) * (xMax - xMin + 1) + (x - xMin));
          d[pos + 0] = 0xff; // R
          d[pos + 1] = 0xff; // G
          d[pos + 2] = 0xff; // B
          d[pos + 3] = 0xff; // A
        }
      }
    }

    return {
      x: xMin,
      y: yMin,
      imageData: imageData,
      width: imageData.width,
      height: imageData.height
    };
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

    if (currentChar !== ' ') {
      var oldData = charToImageData[currentChar];
      ctx.clearRect(oldData.x, oldData.y, oldData.width, oldData.height);
    }

    if (c !== ' ') {
      var data = charToImageData[c];
      ctx.putImageData(data.imageData, data.x, data.y);
      canvas.classList.add('highlight');
    } else {
      canvas.classList.remove('highlight');
    }

    currentChar = c;
  }

  function maybeHover(ev) {
    const c = evToChar(ev);
    if (c !== currentChar) {
      highlightChar(c);
    }
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
