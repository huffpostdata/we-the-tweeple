var makeHeaderInteractive = require('./_header');
var makeStoryDiagrams = require('./_story-diagrams');
var html_escape = require('./_html-escape');
var renderVenn = require('./_venn');
var Database = require('./_database');
var formatInt = require('./_format-int');

var RootPath = '/2016/we-the-tweeple';  // XXX autocomplete this?

var database = new Database(); // until we load

function progressPathD(fraction) {
  var x = 10 + 10 * Math.sin(2 * Math.PI * fraction);
  var y = 10 - 10 * Math.cos(2 * Math.PI * fraction);
  var largeArcFlag = fraction >= 0.5 ? '1' : '0';
  return 'M10,10V0A 10,10 0 ' +  largeArcFlag + ',1 ' + x + ',' + y + 'Z';
}

/**
 * Sets `database`, then calls `callback(err)`.
 */
function loadTsv(url, progressSvg, progressPath, onProgress, onDone) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  var pos = 0;

  xhr.onprogress = function(ev) {
    var partialTsv = xhr.responseText.slice(pos);
    database.addPartialTxt(xhr.responseText.slice(pos));
    pos += partialTsv.length;

    // We can't calculate the byte length: Content-Length is gzipped. So we
    // need to know beforehand how long the file is. Number of groups is a
    // good measure.
    //

    var fraction = database.groups.length / database.nGroups;
    progressPath.setAttribute('d', progressPathD(fraction));
    onProgress();
  };

  xhr.onload = function() {
    if (xhr.status === 200 || xhr.status === 304) {
      database.addPartialTxt(xhr.responseText.slice(pos), true);
      progressSvg.parentNode.removeChild(progressSvg);
      onProgress();
      onDone();
    } else {
      onDone(new Error("Invalid status code from server: " + xhr.status));
    }
  };
  xhr.send();
}

function main() {
  var NMatchesToDisplay = 15;
  var app_el = document.querySelector('#app');

  var els = {
    input: app_el.querySelector('[name=q]'),
    autocomplete: app_el.querySelector('.autocomplete'),
    resultContainer: app_el.querySelector('.result'),
    emptyResult: app_el.querySelector('.result .empty'),
    loading: app_el.querySelector('.loading'),
    result: document.createElement('div'),
    progressSvg: app_el.querySelector('svg.progress'),
    progressPath: app_el.querySelector('svg.progress path'),
    bird: app_el.querySelector('span.bird')
  };
  els.result.className = 'hit';

  var autocompleteMatches = [];
  var autocompleteIndex = -1;

  function autocomplete(prefix) {
    showMatch(null);

    var prefix = els.input.value;
    autocompleteMatches = (prefix === '') ? [] : database.prefixSearch(prefix, NMatchesToDisplay);
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
      var maxN = autocompleteMatches.reduce(function(s, m) { return Math.max(s, m.group.nClinton, m.group.nTrump); }, 0);

      els.autocomplete.innerHTML = '<ul>'
        + autocompleteMatches.map(function(m) {
          return [
            '<li><a href="#!', encodeURIComponent(m.text), '">',
              '<span class="token"><mark>', html_escape(m.text.slice(0, prefix.length)), '</mark>', m.text.slice(prefix.length), '</span>',
              '<span class="n">', formatInt(m.groupN), '</span>',
              renderVenn(maxN, m).svg,
            '</a></li>'
          ].join('');
        }).join('')
        + '</ul>';

      if (autocompleteMatches[0].foldedText === prefix.toLowerCase() || autocompleteMatches.length === 1) {
        autocompleteIndex = 0;
        els.autocomplete.querySelector('li').classList.add('hover');
      }
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

  function showFirstAutocompleteIfEqual() {
    if (autocompleteMatches.length > 0 && autocompleteMatches[0].foldedText === els.input.value.toLowerCase()) {
      showMatch(autocompleteMatches[0]);
    } else {
      showMatch(null);
    }
  }

  function showMatch(matchOrNull) {
    if (!matchOrNull) {
      window.history.replaceState({}, '', RootPath);

      if (els.result.parentNode !== null) els.resultContainer.removeChild(els.result);
    } else {
      autocomplete(); // So when we blur, the list is correct
      els.autocomplete.classList.add('input-empty');

      var token = matchOrNull;
      var group = token.group;

      window.history.replaceState({}, '', RootPath + '/' + encodeURIComponent(token.text));

      var venn = renderVenn(Math.max(group.nClinton, group.nTrump), token);
      var m = venn.measurements;

      els.result.innerHTML = [
        token.variantsHtml(),
        venn.html,
        token.sentenceHtml()
      ].join('');

      els.resultContainer.appendChild(els.result);

      if (window.hasOwnProperty('bN')) bN.ping('search', { search_terms: token.text });
    }
  }

  els.input.addEventListener('input', autocomplete);
  els.input.addEventListener('blur', showFirstAutocompleteIfEqual);

  // Use keyboard to navigate autocomplete entry
  els.input.addEventListener('keydown', function(ev) {
    var c = ev.keyCode;

    switch (c) {
      case 13: // Enter
      case 27: // Escape
        ev.preventDefault();
        if (autocompleteIndex === -1) {
          showFirstAutocompleteIfEqual();
        } else {
          var match = autocompleteMatches[autocompleteIndex];
          els.input.value = match.text;
          showMatch(match);
        }
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
    var match = autocompleteMatches[index];
    if (!match) return; // clicked on border or "No matches found"
    els.input.value = match.text;
    showMatch(match);
  }
  els.autocomplete.addEventListener('mousedown', selectAutocompleteFromEvent);
  els.autocomplete.addEventListener('touchstart', selectAutocompleteFromEvent);

  els.bird.addEventListener('click', function() {
    els.input.value = 'bird';
    autocomplete();
    showMatch(autocompleteMatches[0]); // assume the search matches
  });

  makeHeaderInteractive(function(tokenText) {
    els.input.value = tokenText;
    autocomplete();
    showMatch(autocompleteMatches[0]); // assume the search matches
  });

  if (document.body.hasAttribute('data-search-term')) {
    els.input.value = document.body.getAttribute('data-search-term');
  }

  makeStoryDiagrams(database, function(token) {
    els.input.value = token.text;
    autocomplete();
    showMatch(autocompleteMatches[0]);
  });

  loadTsv(app_el.getAttribute('data-tsv-path'), els.progressSvg, els.progressPath, function() {
    // Try to show the word, even before loading finishes. This usually works
    // because most shares are of unigrams.
    autocomplete();
    if (els.input !== document.activeElement) {
      showMatch(autocompleteMatches[0]); // may be undefined
    }
  }, function(err) {
    console.log(err); // TK show error
    els.loading.parentNode.removeChild(els.loading);
  });
}

main();
