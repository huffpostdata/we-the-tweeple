var html_escape = require('./_html-escape');

var formatInt = require('./_format-int');

function Group(database, id, nClinton, nTrump, nBoth, nVariants) {
  this.database = database;
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

function Token(group, positionInGroup, text) {
  this.group = group;
  this.positionInGroup = positionInGroup;
  this.text = text;
  // It would be great to handle accents and such, but JavaScript's intl support
  // is too spotty. For instance, String.prototype.normalize() doesn't exist on
  // IE11. And Intl.Collator doesn't let us extract a collation "key" that would
  // precompute the hard parts and let us compare strings quickly.
  //
  // this.foldedText is our super-simple collation key.
  this.foldedText = text.toLowerCase();
  this.groupN = this.group.n;
}

/**
 * Renders "similar spellings" HTML, or an empty String if `nVariants === 1`
 */
Token.prototype.variantsHtml = function() {
  var _this = this;
  var group = this.group;

  var nToWord = [ 'no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine' ];

  if (group.nVariants <= 1) return '';

  var liHtmls = group.tokens
    .filter(function(t) { return t !== _this; })
    .slice(0, 2)
    .map(function(token) {
      return '<li><q>' + html_escape(token.text) + '</q></li>';
    });
  var nOther = group.nVariants - liHtmls.length - 1;
  if (nOther > 0) {
    if (nOther === 1) {
      liHtmls.push('<li class="other">1 similar spelling</li>');
    } else {
      liHtmls.push('<li class="other">' + (nToWord[nOther] || String(nOther)) + ' similar spellings</li>');
    }
  }
  return [
    '<div class="variants">',
      'Includes <ul>', liHtmls.join(''), '</ul>',
    '</div>'
  ].join('');
};

Token.prototype.sentenceData = function() {
  var group = this.group;

  if (group.nClinton === 0 || group.nTrump === 0) {
    return {
      winner: group.nClinton > 0 ? 'Clinton' : 'Trump',
      loser: '',
      winPercent: 0
    };
  } else {
    var fClinton = group.nClinton / group.database.nClintonWithBio;
    var fTrump = group.nTrump / group.database.nTrumpWithBio;
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
    return 'Clinton and Trump followers use the term TOKEN with equal frequency in their Twitter bios.';
  } else if (data.loser === '') {
    return 'Only WINNER followers use the term TOKEN in their Twitter bios.';
  } else {
    return 'WINNER followers are PERCENT percent more likely to use the term TOKEN in their Twitter bios than LOSER followers.';
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
    .replace(/PERCENT/, formatInt(data.winPercent || 0))
    + ' <a class="methodology" href="/2016/we-the-tweeple/methodology">methodology »</a>'
    + '</h4>';
};

function Database() {
  this.nGroups = 128794; // TODO would be nice not to hard-code this
  // (In the meantime: `grep -c $'\t' group-tokens.txt`)
  this.groups = [];
  this.tokens = [];
  this.maxNgramSize = 0;
  this._endOfLastTxt = '';
  this._doneWithHeader = false;
}

/**
 * Adds more data.
 *
 * Params:
 * * txt: some of the text data. Since we don't know whether the final group is
 *        complete, it will be buffered until the next data comes in.
 * * isLastPart: if true, the caller promises that the final group is complete.
 */
Database.prototype.addPartialTxt = function(txt, isLastPart) {
  txt = this._endOfLastTxt + txt

  // There's no point in parsing a tiny portion of the database. Also, the
  // regexes for the header expect a minimum length.
  if (!isLastPart && txt.length < 10000) {
    this._endOfLastTxt = txt;
    return;
  }

  var lastIndex = 0;

  if (!this._doneWithHeader) {
    // "header" is a few lines that look like: "n: \d+\nnClinton: \d+\n...".
    // We write these straight to this.n, this.nClinton, etc.
    var headerRe = /(\w+): (\d+)\n/g;
    while (true) {
      var headerM = headerRe.exec(txt);
      if (headerM === null) {
        this._doneWithHeader = true;
        txt = txt.slice(lastIndex);
        lastIndex = 0;
        break;
      } else {
        this[headerM[1]] = +headerM[2];
      }
    }
  }

  var tokens = []; // This chunk's round of tokens

  var groupRe = /(\d+)\t(\d+)\t(\d+)\t(\d+)\n((?:[^\t\n]+\n)+)/g;
  var id = 0;
  while (true) {
    var m = groupRe.exec(txt);
    if (m === null) break;
    if (!isLastPart && txt.indexOf('\t', groupRe.lastIndex) === -1) {
      // There's no group after this one, so we don't want to process it.
      break;
    }

    id += 1;
    var group = new Group(this, id, +m[1], +m[2], +m[3], +m[4]);
    this.groups.push(group);

    var tokenTexts = m[5].slice(0, m[5].length - 1).split('\n')
    for (var i = 0; i < tokenTexts.length; i++) {
      var token = new Token(group, i, tokenTexts[i]);
      group.tokens.push(token);
      tokens.push(token);
    }

    lastIndex = groupRe.lastIndex;
  }

  this._endOfLastTxt = txt.slice(lastIndex);

  // Merge the new tokens into this.tokens.
  //
  // Since we know this.tokens is sorted, it's quick to sort just the new stuff
  // and then merge.
  tokens.sort(function(a, b) {
    return a.foldedText < b.foldedText ? -1 : 1; // Assume a.text != b.text, ever
  });

  var nTokens = tokens.length + this.tokens.length;
  var mergedTokens = new Array(nTokens);
  for (var i = 0, j = 0, k = 0; k < nTokens; k++) {
    if (i === this.tokens.length) {
      mergedTokens[k] = tokens[j];
      j += 1;
    } else if (j === tokens.length) {
      mergedTokens[k] = this.tokens[i];
      i += 1;
    } else if (this.tokens[i].foldedText < tokens[j].foldedText) {
      mergedTokens[k] = this.tokens[i];
      i += 1;
    } else {
      mergedTokens[k] = tokens[j];
      j += 1;
    }
  }
  this.tokens = mergedTokens;
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
    return (b.groupN - a.groupN) || (a.positionInGroup - b.positionInGroup) || a.foldedText.localeCompare(b.foldedText);
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
