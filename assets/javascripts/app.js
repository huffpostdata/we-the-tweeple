'use strict'

var groups = [];
var tokens = [];

function Group(id, nClinton, nTrump, nBoth, nVariants) {
  this.id = id;
  this.nClinton = nClinton;
  this.nTrump = nTrump;
  this.nBoth = nBoth;
  this.n = this.nClinton + this.nTrump - this.nBoth;
  this.nVariants = nVariants;
  this.tokens = [];
}

function Token(group, n, text) {
  this.group = group;
  this.n = n;
  this.text = text;
  this.foldedText = text.toLowerCase();
  this.groupN = this.group.n;
}

/**
 * Returns the "best" `n` tokens that match the prefix.
 */
function search(prefix, n) {
  var foldedPrefix = prefix.toLowerCase();

  // Find first index, using binary search.
  // We're searching for prefix. If we search [ "fib", "foo" ] for "fo", we'll
  // end up with begin=1 -- the index of "foo", the first match.
  var begin = 0, end = tokens.length;
  while (begin < end) {
    var mid = (begin + end) >> 1;
    var token = tokens[mid];
    if (foldedPrefix <= token.foldedText) {
      end = mid;
    } else {
      begin = mid + 1;
    }
  }
  if (begin === tokens.length) return [];

  // Find last index, using iteration. Binary search wouldn't speed things up,
  // because we need at least O(n) to collect results.
  var matches = [];
  for (var i = begin; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.foldedText.slice(0, foldedPrefix.length) !== foldedPrefix) break;
    matches.push(token);
  }

  // Sort matches. The prefix is the first; the others are by popularity.
  matches.sort(function(a, b) {
    if (a.foldedText === foldedPrefix) return -1;
    if (b.foldedText === foldedPrefix) return 1;
    return (b.groupN - a.groupN) || (b.n - a.n) || a.foldedText.localeCompare(b.foldedText);
  });

  // Pick the top N matches.
  //
  // Are there two tokens from the same group? Nix the second, since the first
  // is most important.
  var uniqueMatches = [];
  var usedGroups = {};
  for (var i = 0; i < matches.length && uniqueMatches.length < n; i++) {
    var token = matches[i];
    if (usedGroups.hasOwnProperty(token.group.id)) continue;
    usedGroups[token.group.id] = null;
    uniqueMatches.push(token);
  }

  // Sort the matches alphabetically.
  uniqueMatches.sort(function(a, b) {
    return a.foldedText.localeCompare(b.foldedText); // prefix is shortest, so it's first
  });

  return uniqueMatches;
}

/**
 * Sets `groups` and `tokens`, then calls `callback(err)`.
 */
function loadTsv(url, callback) {
  function setTsv(text) {
    var groupRe = /(\d+)\t(\d+)\t(\d+)\t(\d+)\n((?:\d+\t[^\t\n]+\n)+)/g;
    var id = 0;
    while (true) {
      var m = groupRe.exec(text);
      if (m === null) break;

      id += 1;
      var group = new Group(id, +m[1], +m[2], +m[3], +m[4]);
      groups.push(group);

      var tokensString = m[5];

      var tokenRe = /(\d+)\t([^\t\n]+)\n/g;
      while (true) {
        var m2 = tokenRe.exec(tokensString);
        if (m2 === null) break;

        var token = new Token(group, +m2[1], m2[2]);
        group.tokens.push(token);
        tokens.push(token);
      }
    }

    tokens.sort(function(a, b) {
      return a.foldedText < b.foldedText ? -1 : 1; // Assume a.text != b.text, ever
    });
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;

    if (xhr.status === 200) {
      setTsv(xhr.responseText);
      callback();
    } else {
      callback(new Error("Invalid status code from server: " + xhr.status));
    }
  };
  xhr.send();
}

function html_escape(s) {
  return s.replace(/&<>"'/g, function(c) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }[c];
  });
}

/**
 * Converts 1234567 to "1,234,567".
 */
function format_int(n) {
  return n.toFixed(0)
    .replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

/**
 * Returns a <svg> string with a Venn diagram sized according to the input.
 *
 * Paramters:
 *   nPopulation: focus population (e.g., "we're looking at 200 people")
 *   nClinton: number of Clinton followers
 *   nTrump: number of Trump followers
 *   nBoth: number of Clinton followers who are also Trump followers
 */
function renderVennSvg(nPopulation, nClinton, nTrump, nBoth) {
  var rClinton = 50 * Math.sqrt(nClinton / nPopulation);
  var rTrump = 50 * Math.sqrt(nTrump / nPopulation);

  // Fail fast for botnet-y stuff
  if (rClinton === 0 && rTrump === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"></svg>';
  } else if (rClinton === 0) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="trump" cx="100" cy="50" r="', rTrump, '"/>',
      '</svg>'
    ].join('');
  } else if (rTrump === 0) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="clinton" cx="100" cy="50" r="', rClinton, '"/>',
      '</svg>'
    ].join('');
  }

  var aClinton = rClinton * rClinton * Math.PI;
  var aTrump = rTrump * rTrump * Math.PI;
  var aBoth = Math.min(aTrump, aClinton, Math.max(aClinton, aTrump) * nBoth / Math.max(nClinton, nTrump));

  if (aBoth === aClinton) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="clinton" cx="100" cy="50" r="', rClinton, '"/>',
        '<circle class="trump" cx="100" cy="50" r="', rTrump, '"/>',
      '</svg>'
    ].join('');
  } else if (aBoth === aTrump) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
        '<circle class="trump" cx="100" cy="50" r="', rTrump, '"/>',
        '<circle class="clinton" cx="100" cy="50" r="', rClinton, '"/>',
      '</svg>'
    ].join('');
  }

  // http://mathworld.wolfram.com/Circle-CircleIntersection.html
  function dToArea(d) {
    var p1 = rClinton * rClinton * Math.acos((d * d + rClinton * rClinton - rTrump * rTrump) / (2 * d * rClinton));
    var p2 = rTrump * rTrump * Math.acos((d * d + rTrump * rTrump - rClinton * rClinton) / (2 * d * rTrump));

    var inRoot = 1
      * (-d + rClinton + rTrump)
      * (+d + rClinton - rTrump)
      * (+d - rClinton + rTrump)
      * (+d + rClinton + rTrump);

    return p1 + p2 - 1 / 2 * Math.sqrt(inRoot);
  }

  function dToY(d) {
    var toRoot = 1
      * (-d + rClinton - rTrump)
      * (-d - rClinton + rTrump)
      * (-d + rClinton + rTrump)
      * (+d + rClinton + rTrump);
    return 1 / 2 / d * Math.sqrt(toRoot);
  }

  function solveForD(a) {
    var Tolerance2 = 0.000001;
    var MaxIter = 10000;

    var minD = 0;
    var maxD = rClinton + rTrump;

    for (var i = 0; i < MaxIter; i++) {
      var tryD = (minD + maxD) / 2;
      var err = dToArea(tryD) - a;
      if (err < Tolerance2 && err > -Tolerance2) return tryD;
      if (err < 0) {
        // area we found is smaller than what we want. Smaller d => larger area
        maxD = tryD;
      } else {
        // Our area is too big. Move circles apart. Smaller D => larger area
        minD = tryD;
      }
    }

    return (minD + maxD) / 2;
  }

  var d = solveForD(aBoth);
  var xTrump = (d * d - rClinton * rClinton + rTrump * rTrump) / (2 * d);
  var xClinton = d - xTrump;
  var yArc = dToY(d);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">',
      '<circle class="clinton" cx="', (100 - xClinton), '" cy="50" r="', rClinton, '"/>',
      '<circle class="trump" cx="', (100 + xTrump), '" cy="50" r="', rTrump, '"/>',
      '<path class="both" d="',
        'M100,', (50 + yArc),
        'A', rTrump, ',', rTrump, ' 0 ', (xTrump < 0 ? 1 : 0), ',1 100,', (50 - yArc),
        'A', rClinton, ',', rClinton, ' 0 ', (xClinton < 0 ? 1 : 0), ',1 100,', (50 + yArc),
        'Z"/>',
    '</svg>'
  ].join('');
}

document.addEventListener('DOMContentLoaded', function() {
  var NMatchesToDisplay = 15;
  var app_el = document.querySelector('#app');

  var els = {
    input: app_el.querySelector('[name=q]'),
    autocomplete: app_el.querySelector('.autocomplete'),
    resultContainer: app_el.querySelector('.result'),
    emptyResult: app_el.querySelector('.result .empty'),
    loading: app_el.querySelector('.loading'),
    result: document.createElement('div')
  };
  els.result.className = 'hit';

  var autocompleteMatches = [];
  var autocompleteIndex = -1;

  function autocomplete(prefix) {
    if (groups.length === 0) return; // Not loaded yet. Only happens during init.

    showMatch(null);

    var prefix = els.input.value;
    autocompleteMatches = (prefix === '') ? [] : search(prefix, NMatchesToDisplay);
    autocompleteIndex = -1; // so "down" goes to 0

    els.autocomplete.className = [
      'autocomplete',
      (prefix === '' ? 'input-empty' : ''),
      (autocompleteMatches.length === 0 ? 'no-results' : 'has-results')
    ].join(' ');

    if (prefix === '') { // empty search
      els.autocomplete.innerHTML = '';
    } else if (autocompleteMatches.length === 0) {
      els.autocomplete.innerHTML = 'No matches found';
    } else {
      var maxN = autocompleteMatches.reduce(function(s, m) { return Math.max(s, m.group.n); }, 0);

      els.autocomplete.innerHTML = '<ul>'
        + autocompleteMatches.map(function(m) {
          return [
            '<li><a href="#!', encodeURIComponent(m.text), '">',
              '<span class="token"><mark>', html_escape(m.text.slice(0, prefix.length)), '</mark>', m.text.slice(prefix.length), '</span>',
              '<span class="n">', format_int(m.groupN), '</span>',
              renderVennSvg(maxN, m.group.nClinton, m.group.nTrump, m.group.nBoth),
            '</a></li>'
          ].join('');
        }).join('')
        + '</ul>';
    }
  }

  function setWrappedAutocompleteIndex(index) {
    if (autocompleteMatches.length === 0) return;
    if (index >= autocompleteMatches.length) index = 0;
    if (index < 0) index = autocompleteMatches.length - 1;

    autocompleteIndex = index;

    var newHover = els.autocomplete.querySelectorAll('li')[autocompleteIndex];
    var oldHover = els.autocomplete.querySelector('li.hover');
    if (newHover !== oldHover && oldHover !== null) oldHover.classList.remove('hover');
    newHover.classList.add('hover');
  }

  function findIndexOfAutocompleteNode(node) {
    while (node.tagName !== 'LI' && node !== els.autocomplete) {
      node = node.parentNode;
    }
    if (node === els.autocomplete) return;

    var nodeAndSiblings = node.parentNode.childNodes;
    for (var i = 0; i < nodeAndSiblings.length; i++) {
      if (nodeAndSiblings[i] === node) {
        return i;
      }
    }

    return 0;
  }

  function cancelAutocomplete() {
    els.autocomplete.classList.add('input-empty');
    autocompleteMatches = [];
    autocompleteIndex = -1;
  }

  function showFirstAutocompleteIfEqual() {
    if (autocompleteMatches.length > 0 && autocompleteMatches[0].foldedText === els.input.value.toLowerCase()) {
      showMatch(autocompleteMatches[0]);
    } else {
      showMatch(null);
    }
  }

  function showMatch(matchOrNull) {
    cancelAutocomplete();

    if (!matchOrNull) {
      if (els.result.parentNode !== null) els.resultContainer.removeChild(els.result);
    } else {
      var group = matchOrNull.group;
      els.result.innerHTML = renderVennSvg(group.n, group.nClinton, group.nTrump, group.nBoth);
      els.resultContainer.appendChild(els.result);
    }
  }

  els.input.addEventListener('input', autocomplete);
  els.input.addEventListener('focus', autocomplete); // typing something new...
  els.input.addEventListener('blur', showFirstAutocompleteIfEqual);

  // Use keyboard to navigate autocomplete entry
  els.input.addEventListener('keydown', function(ev) {
    var c = ev.keyCode;

    switch (c) {
      case 13: // Enter
        ev.preventDefault();
        if (autocompleteIndex === -1) {
          showFirstAutocompleteIfEqual();
        } else {
          var match = autocompleteMatches[autocompleteIndex];
          els.input.value = match.text;
          showMatch(match);
        }
        break;
      case 27: // Escape
        ev.preventDefault();
        cancelAutocomplete();
        break;
      case 38: // Down
      case 40: // Up
        setWrappedAutocompleteIndex(autocompleteIndex + (c === 38 ? -1 : 1));
        ev.preventDefault();
        break;
    }
  });

  // On hover, "hover" over autocomplete entry
  els.autocomplete.addEventListener('mousemove', function(ev) {
    setWrappedAutocompleteIndex(findIndexOfAutocompleteNode(ev.target) || 0);
  });

  // We can't handle "click" or "touch", because they'd blur the input, which
  // has its own event handler. Instead, we handle mousedown and touchstart.
  function selectAutocompleteFromEvent(ev) {
    ev.preventDefault();
    var index = findIndexOfAutocompleteNode(ev.target) || 0;
    var match = autocompleteMatches[autocompleteIndex];
    if (!match) return; // clicked on border or "No matches found"
    els.input.value = match.text;
    showMatch(match);
  }
  els.autocomplete.addEventListener('mousedown', selectAutocompleteFromEvent);
  els.autocomplete.addEventListener('touchstart', selectAutocompleteFromEvent);

  loadTsv(app_el.getAttribute('data-tsv-path'), function() {
    els.loading.parentNode.removeChild(els.loading);
    autocomplete(); // in case the user typed something in
  });
});
