var html_escape = require('./_html-escape');

var formatInt = require('./_format-int');

var nClintonTotal = 3103739; // TK adjust this -- num with bios
var nTrumpTotal = 3926005; // TK adjust this -- num with bios
var nBothTotal = 747171; // TK adjust this -- num with bios

function Group(id, nClinton, nTrump, nBoth, nVariants) {
  this.id = id;
  this.nClinton = nClinton;
  this.nTrump = nTrump;
  this.nBoth = nBoth;
  this.nOnlyClinton = nClinton - nBoth;
  this.nOnlyTrump = nTrump - nBoth;
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

Token.prototype.sentenceData = function() {
  var group = this.group;

  if (group.nClinton === 0 || group.nTrump === 0) {
    return {
      winner: group.nClinton > 0 ? 'Clinton' : 'Trump',
      loser: '',
      winPercent: 0
    };
  } else {
    var fClinton = group.nClinton / nClintonTotal;
    var fTrump = group.nTrump / nTrumpTotal;
    var winPercent = Math.round(100 * Math.abs(fClinton - fTrump) / Math.min(fClinton, fTrump));
    if (winPercent === 0) {
      return {
        winner: '',
        loser: '',
        winPercent: 0
      };
    } else {
      var winner = fClinton > fTrump ? 'Clinton' : 'Trump';
      var loser = fClinton < fTrump ? 'Clinton' : 'Trump';

      return {
        winner: winner,
        loser: loser,
        winPercent: winPercent
      };
    }
  }
};

Token.prototype.sentenceTemplate = function(data) {
  if (data.winner === '') {
    return 'Clinton and Trump followers use the phrase TOKEN in equal proportions in their Twitter bios.';
  } else if (data.loser === '') {
    return 'Only WINNER followers use the phrase TOKEN in their Twitter bios.';
  } else {
    return 'WINNER followers are PERCENT% more likely to use the phrase TOKEN in their Twitter bios than LOSER followers.';
  }
};

Token.prototype.sentenceText = function() {
  var data = this.sentenceData();

  return this.sentenceTemplate(data)
    .replace(/TOKEN/, '“' + this.text + '”')
    .replace(/WINNER/, data.winner)
    .replace(/LOSER/, data.loser)
    .replace(/PERCENT/, formatInt(data.winPercent || 0));
};

Token.prototype.sentenceHtml = function() {
  var data = this.sentenceData();

  return '<h4 class="' + (data.winner.toLowerCase() || 'tie') + '">' + this.sentenceTemplate(data)
    .replace(/TOKEN/, '<q>' + html_escape(this.text) + '</q>')
    .replace(/WINNER/, '<strong class="winner">' + data.winner + '</strong>')
    .replace(/LOSER/, '<strong class="loser">' + data.loser + '</strong>')
    .replace(/PERCENT/, formatInt(data.winPercent || 0)) + '</h4>';
};

function Database(tsv) {
  var groups = [];
  var tokens = [];

  var groupRe = /(\d+)\t(\d+)\t(\d+)\t(\d+)\n((?:\d+\t[^\t\n]+\n)+)/g;
  var id = 0;
  while (true) {
    var m = groupRe.exec(tsv);
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

  this.groups = groups;
  this.tokens = tokens;
}

/**
 * Find first index, using binary search, or `null`.
 *
 * We're searching for prefix. If we search [ "fib", "foo" ] for "fo", we'll
 * end up with begin=1 -- the index of "foo", the first match.
 */
Database.prototype._findPrefixIndex = function(prefix) {
  var foldedPrefix = prefix.toLowerCase();
  var tokens = this.tokens;

  // binary search
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

  return (begin === tokens.length) ? null : begin;
}

/**
 * Returns the "best" `n` tokens that match the prefix.
 */
Database.prototype.prefixSearch = function(prefix, n) {
  var begin = this._findPrefixIndex(prefix);
  if (begin === null) return [];

  // Find last index, using iteration. Binary search wouldn't scale any better:
  // we sort() after, and that's O(n lg n).
  var foldedPrefix = prefix.toLowerCase();
  var tokens = this.tokens;
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
 * Returns the Token with the given (case-insensitive) text, or null.
 */
Database.prototype.find = function(text) {
  var index = this._findPrefixIndex(text);
  if (index === null) return null;
  var token = this.tokens[index];
  return (token.foldedText === text.toLowerCase()) ? token : null;
}

module.exports = Database;
