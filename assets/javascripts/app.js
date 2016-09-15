'use strict'

var token_strings = []; // Array of unparsed token strings
var NClintonFollowers = 7083642; // TODO remove this "variable"
var NTrumpFollowers = 9286800;   // TODO remove this "variable"
var NBothCollowers = 1693691;

function PrefixMatch(token, clinton_count, trump_count, both_count, string) {
  this.token = token;
  this.clinton_count = clinton_count;
  this.trump_count = trump_count;
  this.both_count = both_count;
  this.total_count = clinton_count + trump_count - both_count;
  this.string = string;
  this._originals = null; // lazy evaluation
}

PrefixMatch.prototype.originals = function() {
  if (this._originals !== null) return this._originals;

  return this._originals = this.string.split('\n')
    .slice(1) // remove token text
    .map(function(s) {
      var row = s.split('\t');
      return {
        n: +row[2],
        text: row[1]
      };
    });
};

PrefixMatch.prototype.topOriginal = function() {
  return this.originals()[0].text;
}

function build_prefix_comparator(search_prefix) {
  function prefix_comparator(v1, v2) {
    if (v1.token === search_prefix) return -1;
    if (v2.token === search_prefix) return 1;
    return v2.total_count - v1.total_count || v1.token.localeCompare(v2.token);
  }
  return prefix_comparator;
}

function index_to_prefix_match(index) {
  var string = token_strings[index];
  var match = index_to_prefix_match.regex.exec(string);
  if (match === null) throw new Error('Line "' + line + '" looks to be invalid');
  return new PrefixMatch(match[1], +match[2], +match[3], +match[4], string);
}
index_to_prefix_match.regex = /([^\t]*)\t(\d+)\t(\d+)\t(\d+)/

function find_prefix_index(prefix) {
  var left = 0;
  var right = token_strings.length; // one past the last element

  // Find leftmost TSV token that matches the prefix

  while (left < right) {
    var mid = (left + right) >> 1;
    var cur_text = token_strings[mid];
    var cur_prefix = cur_text.slice(0, prefix.length);

    if (prefix <= cur_prefix) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  if (left === token_strings.length) return -1;

  var best_prefix = token_strings[left].slice(0, prefix.length);

  return (best_prefix === prefix) ? left : -1;
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

  for (var i = first_index; i < token_strings.length; i++) {
    var prefix_match = index_to_prefix_match(i);
    if (prefix_match.token.slice(0, prefix.length) !== prefix) break;

    insert_into_sorted_array(prefix_match, ret, max_n_matches, comparator);
  }

  return ret;
}

function set_tsv(text) {
  token_strings = [];

  var token_start = 0;
  var p = 0; // Index we're looking at. We'll skip through newlines....
  while (true) {
    var next_p = text.indexOf('\n', p);
    if (next_p == -1) {
      if (p > token_start) {
        token_strings.push(text.slice(token_start));
      }
      break;
    } else if (text[next_p + 1] === '\t') {
      // "\n\t" is a pattern that happens _within_ tokens.
      p = (next_p + 1);
    } else {
      // We finished reading the token. Save it, and add another.
      token_strings.push(text.slice(token_start, next_p));
      token_start = p = (next_p + 1);
    }
  }

  token_strings.sort();
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
    app_el.innerHTML = '<div class="search"><input name="q" autocomplete="off" type="text" placeholder="Type a word…"><div class="results"></div></div><div class="originals"><h4>Most common spellings</h4><ul></ul></div></div>';
    var input_el = app_el.querySelector('input[name=q]');
    var results_el = app_el.querySelector('div.results');
    var originals_ul = app_el.querySelector('div.originals ul');

    input_el.addEventListener('input', function() {
      var prefix = tokenize(input_el.value)
        .map(stem)
        .filter(s => s.length > 0)
        .join(' ');

      var matches = find_prefix_matches(prefix, 15);

      if (prefix === '' || matches.length === 0) {
        results_el.innerHTML = 'No matches found';
      } else {
        var max_count = matches.reduce(function(s, m) { return Math.max(s, m.clinton_count - m.both_count / 2, m.trump_count - m.both_count / 2); }, 0);

        results_el.innerHTML = '<table><thead><tr><th>Word</th><th class="left" colspan="2">Clinton</th><th class="right" colspan="2">Trump</th></tr></thead><tbody>'
          + matches.map(function(m) {
            return '<tr>'
              + '<th>' + html_escape(m.topOriginal()) + '</th>'
              + '<td class="value value-left">' + format_int(m.clinton_count) + '</td>'
              + '<td class="bars" colspan="2">'+ format_token_as_diagram(m, max_count) + '</td>'
              + '<td class="value value-right">' + format_int(m.trump_count) + '</td>'
              + '</tr>';
          }).join('')
          + '</tbody></table>';

        if (matches.length > 0) {
          originals_ul.innerHTML = matches[0].originals().map(function(o) {
            return '<li>'
              + '<span class="count">' + format_int(o.n) + '</span>'
              + '<tt>' + html_escape(o.text) + '</tt>'
              + '</li>';
          }).join('');
        }
      }
    });
  });
});

// Stemmer copied from twittok/src/stemmer.cc
function stem(s) {
  if (stem.should_abort_stem_right_away(s)) return '';
  s = stem.casefold_and_normalize(s);

  if (s.length === 0) return ''; // Empty

  if (stem.EnglishStopwords.indexOf(s) != -1) return ''; // Stopword

  if (s[0] == '#' || s[0] == '@') return s; // Other

  if (!stem.first_codepoint_is_alnum(s)) return ''; // Symbol

  if (/[^a-z]/.test(s)) return s; // Other (non-ASCII)

  return stem.porter2_stem(s);
}
stem.should_abort_stem_right_away = function(s) {
  var is_url_or_just_dots = /^\.+$/.test(s) || (/\./.test(s) && /[^0-9]/.test(s));
  return is_url_or_just_dots;
}
stem.casefold_and_normalize = function(s) {
  return s.toLowerCase(); // we're lazy
}
stem.first_codepoint_is_alnum = function(s) {
  return /^\w/.test(s); // we're lazy
}
stem.porter2_stem = function(s) {
	if (!stem.snowball) stem.snowball = new Snowball('English');

	stem.snowball.setCurrent(s);
	stem.snowball.stem();
	return stem.snowball.getCurrent();
}
stem.EnglishStopwords = [
	"a",
	"about",
	"above",
	"after",
	"again",
	"against",
	"ain",
	"all",
	"am",
	"an",
	"and",
	"any",
	"are",
	"aren",
	"as",
	"at",
	"be",
	"because",
	"been",
	"before",
	"being",
	"below",
	"between",
	"both",
	"but",
	"by",
	"can",
	"couldn",
	"d",
	"did",
	"didn",
	"do",
	"does",
	"doesn",
	"doing",
	"don",
	"down",
	"during",
	"each",
	"few",
	"for",
	"from",
	"further",
	"had",
	"hadn",
	"has",
	"hasn",
	"have",
	"haven",
	"having",
	"he",
	"her",
	"here",
	"hers",
	"herself",
	"him",
	"himself",
	"his",
	"how",
	"i",
	"if",
	"in",
	"into",
	"is",
	"isn",
	"it",
	"its",
	"itself",
	"just",
	"ll",
	"m",
	"ma",
	"me",
	"mightn",
	"more",
	"most",
	"mustn",
	"my",
	"myself",
	"needn",
	"no",
	"nor",
	"not",
	"now",
	"o",
	"of",
	"off",
	"on",
	"once",
	"only",
	"or",
	"other",
	"our",
	"ours",
	"ourselves",
	"out",
	"over",
	"own",
	"re",
	"s",
	"same",
	"shan",
	"she",
	"should",
	"shouldn",
	"so",
	"some",
	"such",
	"t",
	"than",
	"that",
	"the",
	"their",
	"theirs",
	"them",
	"themselves",
	"then",
	"there",
	"these",
	"they",
	"this",
	"those",
	"through",
	"to",
	"too",
	"under",
	"until",
	"up",
	"ve",
	"very",
	"was",
	"wasn",
	"we",
	"were",
	"weren",
	"what",
	"when",
	"where",
	"which",
	"while",
	"who",
	"whom",
	"why",
	"will",
	"with",
	"won",
	"wouldn",
	"y",
	"you",
	"your",
	"yours",
	"yourself",
	"yourselves"
];

function tokenize(s) {
  var tokens = [];

  while (s != '') {
    var m = tokenize.regex.exec(s);
    if (!m) break;

    tokens.push(m[0]);
    s = s.slice(m.index + m[0].length);
  }

	return tokens;
}
// See twittok/build-regex/generate-js.js for this regex
tokenize.regex = /(?:(?:https?:\/\/)?(?:(?:(?:[^!\"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~ \t\n\v\f\r\u0000-\u001F\u007F\uFFFE\ufeff\uFFFF\u202a-\u202e\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000](?:[_-]|[^!\"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~ \t\n\v\f\r\u0000-\u001F\u007F\uFFFE\ufeff\uFFFF\u202a-\u202e\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000])*)?[^!\"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~ \t\n\v\f\r\u0000-\u001F\u007F\uFFFE\ufeff\uFFFF\u202a-\u202e\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]\.)+(?:(?:[^!\"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~ \t\n\v\f\r\u0000-\u001F\u007F\uFFFE\ufeff\uFFFF\u202a-\u202e\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000](?:[-]|[^!\"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~ \t\n\v\f\r\u0000-\u001F\u007F\uFFFE\ufeff\uFFFF\u202a-\u202e\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000])*)?[^!\"#$%&'()*+,-./:;<=>?@\[\]^_`{|}~ \t\n\v\f\r\u0000-\u001F\u007F\uFFFE\ufeff\uFFFF\u202a-\u202e\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000])(?:(?:\.xn--[0-9a-z]+))?)(?::([0-9]+))?(?:\/(?:(?:[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]*(?:(?:[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]+|(?:[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]*\([a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]+\)[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]*))[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]*)*[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9=_#\/\+\-\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]|(?:(?:[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]+|(?:[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]*\([a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]+\)[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]*))))|(?:[a-zA-ZЀ–ӿԀ–ԯⷠ–ⷿꙀ–ꚟᲀ–᲏0-9!\*';:=\+\,\.\$\/%#\[\]\-_~&\|@\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\u0100-\u024f\u0253-\u0254\u0256-\u0257\u0259\u025b\u0263\u0268\u026f\u0272\u0289\u028b\u02bb\u0300-\u036f\u1e00-\u1eff]+\/))*)?(?:\?[a-zA-Z0-9!?\*'\(\);:&=\+\$\/%#\[\]\-_\.,~|@]*[a-zA-Z0-9_&=#\/\-])?)|(?:[<>]?[:;=8][\-o\*\']?[\)\]\(\[dDpPS\/\:\}\{@\|\\]|[\)\]\(\[dDpPS\/\:\}\{@\|\\][\-o\*\']?[:;=8][<>]?|<3)|(?:-+>|<-+)|(?:[@\uff20][a-zA-Z0-9_]+(?:\/[a-zA-Z][a-zA-Z0-9_\-]*)?)|(?:[#\uff03][\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16f1-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u1884\u1887-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5-\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400\u4db5\u4e00\u9fd5\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6e5\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ae\ua7b0-\ua7b7\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab65\uab70-\uabe2\uac00\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7-\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08d4-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0981-\u0983\u09bc\u09be-\u09c4\u09c7-\u09c8\u09cb-\u09cd\u09d7\u09e2-\u09e3\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47-\u0a48\u0a4b-\u0a4d\u0a51\u0a70-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47-\u0b48\u0b4b-\u0b4d\u0b56-\u0b57\u0b62-\u0b63\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0c00-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55-\u0c56\u0c62-\u0c63\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5-\u0cd6\u0ce2-\u0ce3\u0d01-\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62-\u0d63\u0d82-\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2-\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb-\u0ebc\u0ec8-\u0ecd\u0f18-\u0f19\u0f35\u0f37\u0f39\u0f3e-\u0f3f\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f\u109a-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752-\u1753\u1772-\u1773\u17b4-\u17d3\u17dd\u180b-\u180d\u1885-\u1886\u18a9\u1920-\u192b\u1930-\u193b\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f\u1ab0-\u1abe\u1b00-\u1b04\u1b34-\u1b44\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1be6-\u1bf3\u1c24-\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1cf8-\u1cf9\u1dc0-\u1df5\u1dfb-\u1dff\u20d0-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099-\u309a\ua66f-\ua672\ua674-\ua67d\ua69e-\ua69f\ua6f0-\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c5\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9e5\uaa29-\uaa36\uaa43\uaa4c-\uaa4d\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7-\uaab8\uaabe-\uaabf\uaac1\uaaeb-\uaaef\uaaf5-\uaaf6\uabe3-\uabea\uabec-\uabed\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\u0030-\u0039\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0be6-\u0bef\u0c66-\u0c6f\u0ce6-\u0cef\u0d66-\u0d6f\u0de6-\u0def\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f29\u1040-\u1049\u1090-\u1099\u17e0-\u17e9\u1810-\u1819\u1946-\u194f\u19d0-\u19d9\u1a80-\u1a89\u1a90-\u1a99\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\ua620-\ua629\ua8d0-\ua8d9\ua900-\ua909\ua9d0-\ua9d9\ua9f0-\ua9f9\uaa50-\uaa59\uabf0-\uabf9\uff10-\uff19_\u200c\u200d\ua67e\u05be\u05f3\u05f4\uff5e\u301c\u309b\u309c\u30a0\u30fb\u3003\u0f0b\u0f0c\u00b7]+)|(?:(?:[\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16f1-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u1884\u1887-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5-\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400\u4db5\u4e00\u9fd5\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6e5\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ae\ua7b0-\ua7b7\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab65\uab70-\uabe2\uac00\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]+['\-_]+)+[\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16f1-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u1884\u1887-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5-\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400\u4db5\u4e00\u9fd5\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6e5\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ae\ua7b0-\ua7b7\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab65\uab70-\uabe2\uac00\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]+)|(?:[+\-]?[\u0030-\u0039\u00b2-\u00b3\u00b9\u00bc-\u00be\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u09f4-\u09f9\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0b72-\u0b77\u0be6-\u0bf2\u0c66-\u0c6f\u0c78-\u0c7e\u0ce6-\u0cef\u0d58-\u0d5e\u0d66-\u0d78\u0de6-\u0def\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f33\u1040-\u1049\u1090-\u1099\u1369-\u137c\u16ee-\u16f0\u17e0-\u17e9\u17f0-\u17f9\u1810-\u1819\u1946-\u194f\u19d0-\u19da\u1a80-\u1a89\u1a90-\u1a99\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249b\u24ea-\u24ff\u2776-\u2793\u2cfd\u3007\u3021-\u3029\u3038-\u303a\u3192-\u3195\u3220-\u3229\u3248-\u324f\u3251-\u325f\u3280-\u3289\u32b1-\u32bf\ua620-\ua629\ua6e6-\ua6ef\ua830-\ua835\ua8d0-\ua8d9\ua900-\ua909\ua9d0-\ua9d9\ua9f0-\ua9f9\uaa50-\uaa59\uabf0-\uabf9\uff10-\uff19]+([,\/.:\-][\u0030-\u0039\u00b2-\u00b3\u00b9\u00bc-\u00be\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u09f4-\u09f9\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0b72-\u0b77\u0be6-\u0bf2\u0c66-\u0c6f\u0c78-\u0c7e\u0ce6-\u0cef\u0d58-\u0d5e\u0d66-\u0d78\u0de6-\u0def\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f33\u1040-\u1049\u1090-\u1099\u1369-\u137c\u16ee-\u16f0\u17e0-\u17e9\u17f0-\u17f9\u1810-\u1819\u1946-\u194f\u19d0-\u19da\u1a80-\u1a89\u1a90-\u1a99\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249b\u24ea-\u24ff\u2776-\u2793\u2cfd\u3007\u3021-\u3029\u3038-\u303a\u3192-\u3195\u3220-\u3229\u3248-\u324f\u3251-\u325f\u3280-\u3289\u32b1-\u32bf\ua620-\ua629\ua6e6-\ua6ef\ua830-\ua835\ua8d0-\ua8d9\ua900-\ua909\ua9d0-\ua9d9\ua9f0-\ua9f9\uaa50-\uaa59\uabf0-\uabf9\uff10-\uff19]+)*[+\-]?)|(?:[\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16f1-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u1884\u1887-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5-\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400\u4db5\u4e00\u9fd5\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6e5\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ae\ua7b0-\ua7b7\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab65\uab70-\uabe2\uac00\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc\u0030-\u0039\u00b2-\u00b3\u00b9\u00bc-\u00be\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u09f4-\u09f9\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0b72-\u0b77\u0be6-\u0bf2\u0c66-\u0c6f\u0c78-\u0c7e\u0ce6-\u0cef\u0d58-\u0d5e\u0d66-\u0d78\u0de6-\u0def\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f33\u1040-\u1049\u1090-\u1099\u1369-\u137c\u16ee-\u16f0\u17e0-\u17e9\u17f0-\u17f9\u1810-\u1819\u1946-\u194f\u19d0-\u19da\u1a80-\u1a89\u1a90-\u1a99\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249b\u24ea-\u24ff\u2776-\u2793\u2cfd\u3007\u3021-\u3029\u3038-\u303a\u3192-\u3195\u3220-\u3229\u3248-\u324f\u3251-\u325f\u3280-\u3289\u32b1-\u32bf\ua620-\ua629\ua6e6-\ua6ef\ua830-\ua835\ua8d0-\ua8d9\ua900-\ua909\ua9d0-\ua9d9\ua9f0-\ua9f9\uaa50-\uaa59\uabf0-\uabf9\uff10-\uff19_]+)|(?:[^\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16f1-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u1884\u1887-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5-\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400\u4db5\u4e00\u9fd5\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6e5\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ae\ua7b0-\ua7b7\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab65\uab70-\uabe2\uac00\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc\u0030-\u0039\u00b2-\u00b3\u00b9\u00bc-\u00be\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u09f4-\u09f9\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0b72-\u0b77\u0be6-\u0bf2\u0c66-\u0c6f\u0c78-\u0c7e\u0ce6-\u0cef\u0d58-\u0d5e\u0d66-\u0d78\u0de6-\u0def\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f33\u1040-\u1049\u1090-\u1099\u1369-\u137c\u16ee-\u16f0\u17e0-\u17e9\u17f0-\u17f9\u1810-\u1819\u1946-\u194f\u19d0-\u19da\u1a80-\u1a89\u1a90-\u1a99\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249b\u24ea-\u24ff\u2776-\u2793\u2cfd\u3007\u3021-\u3029\u3038-\u303a\u3192-\u3195\u3220-\u3229\u3248-\u324f\u3251-\u325f\u3280-\u3289\u32b1-\u32bf\ua620-\ua629\ua6e6-\ua6ef\ua830-\ua835\ua8d0-\ua8d9\ua900-\ua909\ua9d0-\ua9d9\ua9f0-\ua9f9\uaa50-\uaa59\uabf0-\uabf9\uff10-\uff19]+)/;

/*!
 * Snowball JavaScript Library v0.3
 * http://code.google.com/p/urim/
 * http://snowball.tartarus.org/
 *
 * Copyright 2010, Oleg Mazko
 * http://www.mozilla.org/MPL/
 */

function Snowball(lng) {
	function Among(s, substring_i, result, method) {
		this.s_size = s.length;
		this.s = this.toCharArray(s);
		this.substring_i = substring_i;
		this.result = result;
		this.method = method;
	}
	Among.prototype.toCharArray = function(s) {
		var sLength = s.length, charArr = new Array(sLength);
		for (var i = 0; i < sLength; i++)
			charArr[i] = s.charCodeAt(i);
		return charArr;
	}
	function SnowballProgram() {
		var current;
		return {
			b : 0,
			k : 0,
			l : 0,
			c : 0,
			lb : 0,
			s_c : function(word) {
				current = word;
				this.c = 0;
				this.l = word.length;
				this.lb = 0;
				this.b = this.c;
				this.k = this.l;
			},
			g_c : function() {
				var result = current;
				current = null;
				return result;
			},
			i_g : function(s, min, max) {
				if (this.c < this.l) {
					var ch = current.charCodeAt(this.c);
					if (ch <= max && ch >= min) {
						ch -= min;
						if (s[ch >> 3] & (0X1 << (ch & 0X7))) {
							this.c++;
							return true;
						}
					}
				}
				return false;
			},
			i_g_b : function(s, min, max) {
				if (this.c > this.lb) {
					var ch = current.charCodeAt(this.c - 1);
					if (ch <= max && ch >= min) {
						ch -= min;
						if (s[ch >> 3] & (0X1 << (ch & 0X7))) {
							this.c--;
							return true;
						}
					}
				}
				return false;
			},
			o_g : function(s, min, max) {
				if (this.c < this.l) {
					var ch = current.charCodeAt(this.c);
					if (ch > max || ch < min) {
						this.c++;
						return true;
					}
					ch -= min;
					if (!(s[ch >> 3] & (0X1 << (ch & 0X7)))) {
						this.c++;
						return true;
					}
				}
				return false;
			},
			o_g_b : function(s, min, max) {
				if (this.c > this.lb) {
					var ch = current.charCodeAt(this.c - 1);
					if (ch > max || ch < min) {
						this.c--;
						return true;
					}
					ch -= min;
					if (!(s[ch >> 3] & (0X1 << (ch & 0X7)))) {
						this.c--;
						return true;
					}
				}
				return false;
			},
			e_s : function(s_size, s) {
				if (this.l - this.c < s_size)
					return false;
				for (var i = 0; i < s_size; i++)
					if (current.charCodeAt(this.c + i) != s.charCodeAt(i))
						return false;
				this.c += s_size;
				return true;
			},
			e_s_b : function(s_size, s) {
				if (this.c - this.lb < s_size)
					return false;
				for (var i = 0; i < s_size; i++)
					if (current.charCodeAt(this.c - s_size + i) != s
							.charCodeAt(i))
						return false;
				this.c -= s_size;
				return true;
			},
			f_a : function(v, v_size) {
				var i = 0, j = v_size, c = this.c, l = this.l, common_i = 0, common_j = 0, first_key_inspected = false;
				while (true) {
					var k = i + ((j - i) >> 1), diff = 0, common = common_i < common_j
							? common_i
							: common_j, w = v[k];
					for (var i2 = common; i2 < w.s_size; i2++) {
						if (c + common == l) {
							diff = -1;
							break;
						}
						diff = current.charCodeAt(c + common) - w.s[i2];
						if (diff)
							break;
						common++;
					}
					if (diff < 0) {
						j = k;
						common_j = common;
					} else {
						i = k;
						common_i = common;
					}
					if (j - i <= 1) {
						if (i > 0 || j == i || first_key_inspected)
							break;
						first_key_inspected = true;
					}
				}
				while (true) {
					var w = v[i];
					if (common_i >= w.s_size) {
						this.c = c + w.s_size;
						if (!w.method)
							return w.result;
						var res = w.method();
						this.c = c + w.s_size;
						if (res)
							return w.result;
					}
					i = w.substring_i;
					if (i < 0)
						return 0;
				}
			},
			f_a_b : function(v, v_size) {
				var i = 0, j = v_size, c = this.c, lb = this.lb, common_i = 0, common_j = 0, first_key_inspected = false;
				while (true) {
					var k = i + ((j - i) >> 1), diff = 0, common = common_i < common_j
							? common_i
							: common_j, w = v[k];
					for (var i2 = w.s_size - 1 - common; i2 >= 0; i2--) {
						if (c - common == lb) {
							diff = -1;
							break;
						}
						diff = current.charCodeAt(c - 1 - common) - w.s[i2];
						if (diff)
							break;
						common++;
					}
					if (diff < 0) {
						j = k;
						common_j = common;
					} else {
						i = k;
						common_i = common;
					}
					if (j - i <= 1) {
						if (i > 0 || j == i || first_key_inspected)
							break;
						first_key_inspected = true;
					}
				}
				while (true) {
					var w = v[i];
					if (common_i >= w.s_size) {
						this.c = c - w.s_size;
						if (!w.method)
							return w.result;
						var res = w.method();
						this.c = c - w.s_size;
						if (res)
							return w.result;
					}
					i = w.substring_i;
					if (i < 0)
						return 0;
				}
			},
			r_s : function(c_bra, c_ket, s) {
				var adjustment = s.length - (c_ket - c_bra), left = current
						.substring(0, c_bra), right = current.substring(c_ket);
				current = left + s + right;
				this.l += adjustment;
				if (this.c >= c_ket)
					this.c += adjustment;
				else if (this.c > c_bra)
					this.c = c_bra;
				return adjustment;
			},
			s_ch : function() {
				if (this.b < 0 || this.b > this.k || this.k > this.l
						|| this.l > current.length)
					throw ("faulty slice operation");
			},
			s_f : function(s) {
				this.s_ch();
				this.r_s(this.b, this.k, s);
			},
			s_d : function() {
				this.s_f("");
			},
			i_ : function(c_bra, c_ket, s) {
				var adjustment = this.r_s(c_bra, c_ket, s);
				if (c_bra <= this.b)
					this.b += adjustment;
				if (c_bra <= this.k)
					this.k += adjustment;
			}
		};
	}
	function EnglishStemmer() {
		var a_0 = [new Among("arsen", -1, -1), new Among("commun", -1, -1),
				new Among("gener", -1, -1)], a_1 = [new Among("'", -1, 1),
				new Among("'s'", 0, 1), new Among("'s", -1, 1)], a_2 = [
				new Among("ied", -1, 2), new Among("s", -1, 3),
				new Among("ies", 1, 2), new Among("sses", 1, 1),
				new Among("ss", 1, -1), new Among("us", 1, -1)], a_3 = [
				new Among("", -1, 3), new Among("bb", 0, 2),
				new Among("dd", 0, 2), new Among("ff", 0, 2),
				new Among("gg", 0, 2), new Among("bl", 0, 1),
				new Among("mm", 0, 2), new Among("nn", 0, 2),
				new Among("pp", 0, 2), new Among("rr", 0, 2),
				new Among("at", 0, 1), new Among("tt", 0, 2),
				new Among("iz", 0, 1)], a_4 = [new Among("ed", -1, 2),
				new Among("eed", 0, 1), new Among("ing", -1, 2),
				new Among("edly", -1, 2), new Among("eedly", 3, 1),
				new Among("ingly", -1, 2)], a_5 = [
				new Among("anci", -1, 3), new Among("enci", -1, 2),
				new Among("ogi", -1, 13), new Among("li", -1, 16),
				new Among("bli", 3, 12), new Among("abli", 4, 4),
				new Among("alli", 3, 8), new Among("fulli", 3, 14),
				new Among("lessli", 3, 15), new Among("ousli", 3, 10),
				new Among("entli", 3, 5), new Among("aliti", -1, 8),
				new Among("biliti", -1, 12), new Among("iviti", -1, 11),
				new Among("tional", -1, 1), new Among("ational", 14, 7),
				new Among("alism", -1, 8), new Among("ation", -1, 7),
				new Among("ization", 17, 6), new Among("izer", -1, 6),
				new Among("ator", -1, 7), new Among("iveness", -1, 11),
				new Among("fulness", -1, 9), new Among("ousness", -1, 10)], a_6 = [
				new Among("icate", -1, 4), new Among("ative", -1, 6),
				new Among("alize", -1, 3), new Among("iciti", -1, 4),
				new Among("ical", -1, 4), new Among("tional", -1, 1),
				new Among("ational", 5, 2), new Among("ful", -1, 5),
				new Among("ness", -1, 5)], a_7 = [new Among("ic", -1, 1),
				new Among("ance", -1, 1), new Among("ence", -1, 1),
				new Among("able", -1, 1), new Among("ible", -1, 1),
				new Among("ate", -1, 1), new Among("ive", -1, 1),
				new Among("ize", -1, 1), new Among("iti", -1, 1),
				new Among("al", -1, 1), new Among("ism", -1, 1),
				new Among("ion", -1, 2), new Among("er", -1, 1),
				new Among("ous", -1, 1), new Among("ant", -1, 1),
				new Among("ent", -1, 1), new Among("ment", 15, 1),
				new Among("ement", 16, 1)], a_8 = [new Among("e", -1, 1),
				new Among("l", -1, 2)], a_9 = [
				new Among("succeed", -1, -1), new Among("proceed", -1, -1),
				new Among("exceed", -1, -1), new Among("canning", -1, -1),
				new Among("inning", -1, -1), new Among("earring", -1, -1),
				new Among("herring", -1, -1), new Among("outing", -1, -1)], a_10 = [
				new Among("andes", -1, -1), new Among("atlas", -1, -1),
				new Among("bias", -1, -1), new Among("cosmos", -1, -1),
				new Among("dying", -1, 3), new Among("early", -1, 9),
				new Among("gently", -1, 7), new Among("howe", -1, -1),
				new Among("idly", -1, 6), new Among("lying", -1, 4),
				new Among("news", -1, -1), new Among("only", -1, 10),
				new Among("singly", -1, 11), new Among("skies", -1, 2),
				new Among("skis", -1, 1), new Among("sky", -1, -1),
				new Among("tying", -1, 5), new Among("ugly", -1, 8)], g_v = [
				17, 65, 16, 1], g_v_WXY = [1, 17, 65, 208, 1], g_valid_LI = [
				55, 141, 2], B_Y_found, I_p2, I_p1, habr = [r_Step_1b,
				r_Step_1c, r_Step_2, r_Step_3, r_Step_4, r_Step_5], sbp = new SnowballProgram();
		this.setCurrent = function(word) {
			sbp.s_c(word);
		};
		this.getCurrent = function() {
			return sbp.g_c();
		};
		function r_prelude() {
			var v_1 = sbp.c, v_2;
			B_Y_found = false;
			sbp.b = sbp.c;
			if (sbp.e_s(1, "'")) {
				sbp.k = sbp.c;
				sbp.s_d();
			}
			sbp.c = v_1;
			sbp.b = v_1;
			if (sbp.e_s(1, "y")) {
				sbp.k = sbp.c;
				sbp.s_f("Y");
				B_Y_found = true;
			}
			sbp.c = v_1;
			while (true) {
				v_2 = sbp.c;
				if (sbp.i_g(g_v, 97, 121)) {
					sbp.b = sbp.c;
					if (sbp.e_s(1, "y")) {
						sbp.k = sbp.c;
						sbp.c = v_2;
						sbp.s_f("Y");
						B_Y_found = true;
						continue;
					}
				}
				if (v_2 >= sbp.l) {
					sbp.c = v_1;
					return;
				}
				sbp.c = v_2 + 1;
			}
		}
		function r_mark_regions() {
			var v_1 = sbp.c;
			I_p1 = sbp.l;
			I_p2 = I_p1;
			if (!sbp.f_a(a_0, 3)) {
				sbp.c = v_1;
				if (habr1()) {
					sbp.c = v_1;
					return;
				}
			}
			I_p1 = sbp.c;
			if (!habr1())
				I_p2 = sbp.c;
		}
		function habr1() {
			while (!sbp.i_g(g_v, 97, 121)) {
				if (sbp.c >= sbp.l)
					return true;
				sbp.c++;
			}
			while (!sbp.o_g(g_v, 97, 121)) {
				if (sbp.c >= sbp.l)
					return true;
				sbp.c++;
			}
			return false;
		}
		function r_shortv() {
			var v_1 = sbp.l - sbp.c;
			if (!(sbp.o_g_b(g_v_WXY, 89, 121)
					&& sbp.i_g_b(g_v, 97, 121) && sbp.o_g_b(g_v, 97, 121))) {
				sbp.c = sbp.l - v_1;
				if (!sbp.o_g_b(g_v, 97, 121)
						|| !sbp.i_g_b(g_v, 97, 121)
						|| sbp.c > sbp.lb)
					return false;
			}
			return true;
		}
		function r_R1() {
			return I_p1 <= sbp.c;
		}
		function r_R2() {
			return I_p2 <= sbp.c;
		}
		function r_Step_1a() {
			var a_v, v_1 = sbp.l - sbp.c;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_1, 3);
			if (a_v) {
				sbp.b = sbp.c;
				if (a_v == 1)
					sbp.s_d();
			} else
				sbp.c = sbp.l - v_1;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_2, 6);
			if (a_v) {
				sbp.b = sbp.c;
				switch (a_v) {
					case 1 :
						sbp.s_f("ss");
						break;
					case 2 :
						var c = sbp.c - 2;
						if (sbp.lb > c || c > sbp.l) {
							sbp.s_f("ie");
							break;
						}
						sbp.c = c;
						sbp.s_f("i");
						break;
					case 3 :
						do {
							if (sbp.c <= sbp.lb)
								return;
							sbp.c--;
						} while (!sbp.i_g_b(g_v, 97, 121));
						sbp.s_d();
						break;
				}
			}
		}
		function r_Step_1b() {
			var a_v, v_1, v_3, v_4;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_4, 6);
			if (a_v) {
				sbp.b = sbp.c;
				switch (a_v) {
					case 1 :
						if (r_R1())
							sbp.s_f("ee");
						break;
					case 2 :
						v_1 = sbp.l - sbp.c;
						while (!sbp.i_g_b(g_v, 97, 121)) {
							if (sbp.c <= sbp.lb)
								return;
							sbp.c--;
						}
						sbp.c = sbp.l - v_1;
						sbp.s_d();
						v_3 = sbp.l - sbp.c;
						a_v = sbp.f_a_b(a_3, 13);
						if (a_v) {
							sbp.c = sbp.l - v_3;
							switch (a_v) {
								case 1 :
									var c = sbp.c;
									sbp.i_(sbp.c, sbp.c, "e");
									sbp.c = c;
									break;
								case 2 :
									sbp.k = sbp.c;
									if (sbp.c > sbp.lb) {
										sbp.c--;
										sbp.b = sbp.c;
										sbp.s_d();
									}
									break;
								case 3 :
									if (sbp.c == I_p1) {
										v_4 = sbp.l - sbp.c;
										if (r_shortv()) {
											sbp.c = sbp.l - v_4;
											var c = sbp.c;
											sbp.i_(sbp.c, sbp.c, "e");
											sbp.c = c;
										}
									}
									break;
							}
						}
						break;
				}
			}
		}
		function r_Step_1c() {
			var v_1 = sbp.l - sbp.c;
			sbp.k = sbp.c;
			if (!sbp.e_s_b(1, "y")) {
				sbp.c = sbp.l - v_1;
				if (!sbp.e_s_b(1, "Y"))
					return;
			}
			sbp.b = sbp.c;
			if (sbp.o_g_b(g_v, 97, 121) && sbp.c > sbp.lb)
				sbp.s_f("i");
		}
		function r_Step_2() {
			var a_v;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_5, 24);
			if (a_v) {
				sbp.b = sbp.c;
				if (r_R1()) {
					switch (a_v) {
						case 1 :
							sbp.s_f("tion");
							break;
						case 2 :
							sbp.s_f("ence");
							break;
						case 3 :
							sbp.s_f("ance");
							break;
						case 4 :
							sbp.s_f("able");
							break;
						case 5 :
							sbp.s_f("ent");
							break;
						case 6 :
							sbp.s_f("ize");
							break;
						case 7 :
							sbp.s_f("ate");
							break;
						case 8 :
							sbp.s_f("al");
							break;
						case 9 :
							sbp.s_f("ful");
							break;
						case 10 :
							sbp.s_f("ous");
							break;
						case 11 :
							sbp.s_f("ive");
							break;
						case 12 :
							sbp.s_f("ble");
							break;
						case 13 :
							if (sbp.e_s_b(1, "l"))
								sbp.s_f("og");
							break;
						case 14 :
							sbp.s_f("ful");
							break;
						case 15 :
							sbp.s_f("less");
							break;
						case 16 :
							if (sbp.i_g_b(g_valid_LI, 99, 116))
								sbp.s_d();
							break;
					}
				}
			}
		}
		function r_Step_3() {
			var a_v;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_6, 9);
			if (a_v) {
				sbp.b = sbp.c;
				if (r_R1()) {
					switch (a_v) {
						case 1 :
							sbp.s_f("tion");
							break;
						case 2 :
							sbp.s_f("ate");
							break;
						case 3 :
							sbp.s_f("al");
							break;
						case 4 :
							sbp.s_f("ic");
							break;
						case 5 :
							sbp.s_d();
							break;
						case 6 :
							if (r_R2())
								sbp.s_d();
							break;
					}
				}
			}
		}
		function r_Step_4() {
			var a_v, v_1;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_7, 18);
			if (a_v) {
				sbp.b = sbp.c;
				if (r_R2()) {
					switch (a_v) {
						case 1 :
							sbp.s_d();
							break;
						case 2 :
							v_1 = sbp.l - sbp.c;
							if (!sbp.e_s_b(1, "s")) {
								sbp.c = sbp.l - v_1;
								if (!sbp.e_s_b(1, "t"))
									return;
							}
							sbp.s_d();
							break;
					}
				}
			}
		}
		function r_Step_5() {
			var a_v, v_1;
			sbp.k = sbp.c;
			a_v = sbp.f_a_b(a_8, 2);
			if (a_v) {
				sbp.b = sbp.c;
				switch (a_v) {
					case 1 :
						v_1 = sbp.l - sbp.c;
						if (!r_R2()) {
							sbp.c = sbp.l - v_1;
							if (!r_R1() || r_shortv())
								return;
							sbp.c = sbp.l - v_1;
						}
						sbp.s_d();
						break;
					case 2 :
						if (!r_R2() || !sbp.e_s_b(1, "l"))
							return;
						sbp.s_d();
						break;
				}
			}
		}
		function r_exception2() {
			sbp.k = sbp.c;
			if (sbp.f_a_b(a_9, 8)) {
				sbp.b = sbp.c;
				return sbp.c <= sbp.lb;
			}
			return false;
		}
		function r_exception1() {
			var a_v;
			sbp.b = sbp.c;
			a_v = sbp.f_a(a_10, 18);
			if (a_v) {
				sbp.k = sbp.c;
				if (sbp.c >= sbp.l) {
					switch (a_v) {
						case 1 :
							sbp.s_f("ski");
							break;
						case 2 :
							sbp.s_f("sky");
							break;
						case 3 :
							sbp.s_f("die");
							break;
						case 4 :
							sbp.s_f("lie");
							break;
						case 5 :
							sbp.s_f("tie");
							break;
						case 6 :
							sbp.s_f("idl");
							break;
						case 7 :
							sbp.s_f("gentl");
							break;
						case 8 :
							sbp.s_f("ugli");
							break;
						case 9 :
							sbp.s_f("earli");
							break;
						case 10 :
							sbp.s_f("onli");
							break;
						case 11 :
							sbp.s_f("singl");
							break;
					}
					return true;
				}
			}
			return false;
		}
		function r_postlude() {
			var v_1;
			if (B_Y_found) {
				while (true) {
					v_1 = sbp.c;
					sbp.b = v_1;
					if (sbp.e_s(1, "Y")) {
						sbp.k = sbp.c;
						sbp.c = v_1;
						sbp.s_f("y");
						continue;
					}
					sbp.c = v_1;
					if (sbp.c >= sbp.l)
						return;
					sbp.c++;
				}
			}
		}
		this.stem = function() {
			var v_1 = sbp.c;
			if (!r_exception1()) {
				sbp.c = v_1;
				var c = sbp.c + 3;
				if (0 <= c && c <= sbp.l) {
					sbp.c = v_1;
					r_prelude();
					sbp.c = v_1;
					r_mark_regions();
					sbp.lb = v_1;
					sbp.c = sbp.l;
					r_Step_1a();
					sbp.c = sbp.l;
					if (!r_exception2())
						for (var i = 0; i < habr.length; i++) {
							sbp.c = sbp.l;
							habr[i]();
						}
					sbp.c = sbp.lb;
					r_postlude();
				}
			}
			return true;
		}
	}

	return new EnglishStemmer();
}
