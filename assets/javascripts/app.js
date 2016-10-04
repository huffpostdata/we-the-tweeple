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
 * Sets `groups` and `tokens`
 */
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

function load_tsv(url, callback) {
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

function format_group_as_diagram(group, max_value) {
  var half_mid = group.nBoth / 2;
  var left_value = group.nClinton - half_mid;
  var right_value = group.nTrump - half_mid;
  var full_width = max_value * 2;

  var left1 = .5 - (left_value / full_width);
  var width1 = group.nClinton / full_width;
  var width2 = group.nTrump / full_width;
  var left2 = .5 + (right_value / full_width) - width2;

  return '<div class="log-bars"><div class="log-bar log-bar-left" style="left: ' + (left1 * 100) + '%; width: ' + (width1 * 100) + '%"></div><div class="log-bar log-bar-right" style="left: ' + (left2 * 100) + '%; width: ' + (width2 * 100) + '%"></div><div class="log-bar log-bar-both" style="left: ' + (left2 * 100) + '%; width: ' + (50 * group.nBoth / max_value) + '%;"></div></div>';
}

document.addEventListener('DOMContentLoaded', function() {
  var app_el = document.querySelector('#app');
  app_el.innerHTML = 'Loading...';

  load_tsv(app_el.getAttribute('data-tsv-path'), function() {
    app_el.innerHTML = '<div class="search"><input name="q" autocomplete="off" type="text" placeholder="Type a word…"><div class="results"></div></div><div class="originals"></div></div>';
    var input_el = app_el.querySelector('input[name=q]');
    var results_el = app_el.querySelector('div.results');
    var originals_el = app_el.querySelector('div.originals');

    input_el.addEventListener('input', function() {
      var prefix = input_el.value;
      var NMatchesToDisplay = 15;
      var matches = (prefix === '') ? [] : search(prefix, NMatchesToDisplay);

      if (matches.length === 0) {
        results_el.innerHTML = 'No matches found';
        originals_el.innerHTML = '';
      } else {
        var max_count = matches.reduce(function(s, m) { return Math.max(s, m.group.nClinton - m.group.nBoth / 2, m.group.nTrump - m.group.nBoth / 2); }, 0);

        results_el.innerHTML = '<table><thead><tr><th>Word</th><th class="left" colspan="2">Clinton</th><th class="right" colspan="2">Trump</th></tr></thead><tbody>'
          + matches.map(function(m) {
            return '<tr>'
              + '<th>' + html_escape(m.text) + '</th>'
              + '<td class="value value-left">' + format_int(m.group.nClinton) + '</td>'
              + '<td class="bars" colspan="2">'+ format_group_as_diagram(m.group, max_count) + '</td>'
              + '<td class="value value-right">' + format_int(m.group.nTrump) + '</td>'
              + '</tr>';
          }).join('')
          + '</tbody></table>';

        originals_el.innerHTML = matches.length ? (
          '<h4>Most Common Spellings</h4><ul>'
          + matches[0].group.tokens.map(function(o) {
            return '<li>'
              + '<span class="count">' + format_int(o.n) + '</span>'
              + '<tt>' + html_escape(o.text) + '</tt>'
              + '</li>';
          }).join('')
          + '</ul>'
        ) : '';
      }
    });
  });
});
