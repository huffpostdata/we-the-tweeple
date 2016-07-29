'use strict'

var tsv_string = null;  // String word\tclinton\ttrump TSV
var tsv_offsets = null; // Array of offset integers

function PrefixMatch(token, clinton_count, trump_count) {
  this.token = token;
  this.clinton_count = clinton_count;
  this.trump_count = trump_count;
}

function index_to_prefix_match(index) {
  var start_offset = tsv_offsets[index];
  var end_offset = index < (tsv_offsets.length - 1) ? tsv_offsets[index + 1] : tsv_string.length;
  var line = tsv_string.slice(start_offset, end_offset);
  var match = index_to_prefix_match.regex.exec(line);
  if (match === null) throw new Error('Line "' + line + '" looks to be invalid');
  return new PrefixMatch(match[1], +match[2], +match[3]);
}
index_to_prefix_match.regex = /([^\t]*)\t(\d+)\t(\d+)/

function find_prefix_index(prefix) {
  var left = 0;
  var right = tsv_offsets.length - 1;
  var offset, tsv_token_prefix;

  // Find leftmost TSV token that matches the prefix

  while (left < right) {
    var mid = (left + right) >> 1;
    offset = tsv_offsets[mid];
    tsv_token_prefix = tsv_string.slice(offset, offset + prefix.length);

    if (prefix <= tsv_token_prefix) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  offset = tsv_offsets[left];
  tsv_token_prefix = tsv_string.slice(offset, offset + prefix.length);

  if (tsv_token_prefix === prefix) {
    return left;
  } else {
    return -1;
  }
}

function find_prefix_matches(prefix, max_n_matches) {
  var ret = [];

  var first_index = find_prefix_index(prefix);
  if (first_index == -1) return ret;

  var after_last_index = Math.min(first_index + max_n_matches, tsv_offsets.length);

  for (var i = first_index; i < after_last_index; i++) {
    var prefix_match = index_to_prefix_match(i);
    if (prefix_match.token.slice(0, prefix.length) === prefix) {
      ret.push(prefix_match);
    } else {
      break;
    }
  }

  return ret;
}

function set_tsv(text) {
  tsv_string = text;

  tsv_offsets = [ 0 ];
  var end = tsv_string.length;
  for (var i = 0; i < end; i++) {
    if (text[i] === '\n') {
      tsv_offsets.push(i + 1);
    }
  }
}

function load_tsv(url, callback) {
  console.log("Load URL: " + url);
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;

    if (xhr.status === 200) {
      set_tsv(xhr.responseText);
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
 *  * Converts 1234567 to "1,234,567".
 *   */
function format_int(n) {
  return n.toFixed(0)
    .replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

document.addEventListener('DOMContentLoaded', function() {
  var app_el = document.querySelector('#app');
  app_el.innerHTML = 'Loading...';

  load_tsv(app_el.getAttribute('data-tsv-path'), function() {
    app_el.innerHTML = '<input name="q" autocomplete="off" type="text" placeholder="Type a word…"><div class="results"></div>';
    var input_el = app_el.querySelector('input[name=q]');
    var results_el = app_el.querySelector('div.results');

    input_el.addEventListener('input', function() {
      var prefix = input_el.value.toLowerCase();

      var matches = find_prefix_matches(prefix, 10);

      if (prefix === '' || matches.length === 0) {
        results_el.innerHTML = 'No matches found';
      } else {
        results_el.innerHTML = '<table><thead><tr><th>Word</th><th>Clinton</th><th>Trump</th></tr></thead><tbody>' + matches.map(function(m) { return '<tr><td>' + html_escape(m.token) + '</td><td>' + format_int(m.clinton_count) + '</td><td>' + format_int(m.trump_count) + '</td></tr>'; }).join('') + '</tbody></table>';
      }
    });
  });
});
