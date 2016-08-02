'use strict'

var tsv_string = null;  // String word\tclinton\ttrump TSV
var tsv_offsets = null; // Array of offset integers

function PrefixMatch(token, clinton_count, trump_count, both_count) {
  this.token = token;
  this.clinton_count = clinton_count;
  this.trump_count = trump_count;
  this.both_count = both_count;
  this.either_count = clinton_count + trump_count - both_count;
}

function build_prefix_comparator(search_prefix) {
  function prefix_comparator(v1, v2) {
    if (v1.token === search_prefix) return -1;
    if (v2.token === search_prefix) return 1;
    return v2.either_count - v1.either_count || v1.token.localeCompare(v2.token);
  }
  return prefix_comparator;
}

function index_to_prefix_match(index) {
  var start_offset = tsv_offsets[index];
  var end_offset = index < (tsv_offsets.length - 1) ? tsv_offsets[index + 1] : tsv_string.length;
  var line = tsv_string.slice(start_offset, end_offset);
  var match = index_to_prefix_match.regex.exec(line);
  if (match === null) throw new Error('Line "' + line + '" looks to be invalid');
  return new PrefixMatch(match[1], +match[2], +match[3], +match[4]);
}
index_to_prefix_match.regex = /([^\t]*)\t(\d+)\t(\d+)\t(\d+)/

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

function insert_into_sorted_array(value, array, max_n_elements, comparator) {
  var max_i = Math.min(array.length, max_n_elements);
  var i;

  for (i = 0; i < max_i; i++) {
    if (comparator(value, array[i]) < 0) {
      array.splice(i, 0, value);
      array.splice(max_n_elements);
      return;
    }
  }

  if (i < max_n_elements - 1) {
    array.push(value);
  }
}

function find_prefix_matches(prefix, max_n_matches) {
  var ret = [];

  var first_index = find_prefix_index(prefix);
  if (first_index == -1) return ret;

  var comparator = build_prefix_comparator(prefix);

  for (var i = first_index; i < tsv_offsets.length; i++) {
    var prefix_match = index_to_prefix_match(i);
    if (prefix_match.token.slice(0, prefix.length) !== prefix) break;

    insert_into_sorted_array(prefix_match, ret, max_n_matches, comparator);
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

  tsv_offsets.pop(); // empty newline at end of file
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
 * Converts 1234567 to "1,234,567".
 */
function format_int(n) {
  return n.toFixed(0)
    .replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

function format_token_as_diagram(token, max_value) {
  var half_mid = token.both_count / 2;
  var left_value = token.clinton_count - half_mid;
  var right_value = token.trump_count - half_mid;
  var full_width = max_value * 2;

  var left1 = .5 - (left_value / full_width);
  var width1 = token.clinton_count / full_width;
  var width2 = token.trump_count / full_width;
  var left2 = .5 + (right_value / full_width) - width2;

  return '<div class="log-bars"><div class="log-bar log-bar-left" style="left: ' + (left1 * 100) + '%; width: ' + (width1 * 100) + '%"></div><div class="log-bar log-bar-right" style="left: ' + (left2 * 100) + '%; width: ' + (width2 * 100) + '%"></div><div class="log-bar log-bar-both" style="left: ' + (left2 * 100) + '%; width: ' + (50 * token.both_count / max_value) + '%;"></div></div>';
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
        var max_count = matches.reduce(function(s, m) { return Math.max(s, m.clinton_count - m.both_count / 2, m.trump_count - m.both_count / 2); }, 0);

        results_el.innerHTML = '<table><thead><tr><th>Word</th><th class="left" colspan="2">Clinton</th><th class="right" colspan="2">Trump</th></tr></thead><tbody>'
          + matches.map(function(m) {
            return '<tr>'
              + '<th>' + html_escape(m.token) + '</th>'
              + '<td class="value value-left">' + format_int(m.clinton_count) + '</td>'
              + '<td class="bars" colspan="2">'+ format_token_as_diagram(m, max_count) + '</td>'
              + '<td class="value value-right">' + format_int(m.trump_count) + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table>';
      }
    });
  });
});
