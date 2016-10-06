var renderVennSvg = require('./_venn');
var Database = require('./_database');

var RootPath = '/2016/we-the-tweeple';  // FIXME make this dynamic

var database = new Database(''); // until we load

/**
 * Sets `database`, then calls `callback(err)`.
 */
function loadTsv(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;

    if (xhr.status === 200) {
      database = new Database(xhr.responseText);
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

function main() {
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

      var tokensHtml = '';
      if (group.nVariants > 1) {
        var liHtmls = group.tokens.map(function(token) {
          return '<li><q>' + html_escape(token.text) + '</q><span class="n">' + format_int(token.n) + '</span></li>';
        });
        var nOther = group.nVariants - group.tokens.length;
        if (nOther > 0) {
          if (nOther === 1) {
            liHtmls.push('<li class="other">1 similar spelling</li>');
          } else {
            liHtmls.push('<li class="other">' + nOther + ' similar spellings</li>');
          }
        }
        tokensHtml = [
          '<div class="variants">',
            'Includes <ul>', liHtmls.join(''), '</ul>',
          '</div>'
        ].join('');
      }

      els.result.innerHTML = [
        '<h3>',
          '<span class="n">', format_int(matchOrNull.groupN), '</span>',
          ' followers wrote <q>', html_escape(matchOrNull.text), '</q>',
          ' in their Twitter bios',
        '</h3>',
        renderVennSvg(group.n, group.nClinton, group.nTrump, group.nBoth),
        tokensHtml
      ].join('');

      els.resultContainer.appendChild(els.result);
    }

    if (matchOrNull && matchOrNull.hasSharePage()) {
      window.history.replaceState({}, '', RootPath + '/' + encodeURIComponent(matchOrNull.text));
    } else {
      window.history.replaceState({}, '', RootPath);
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
    var match = autocompleteMatches[autocompleteIndex];
    if (!match) return; // clicked on border or "No matches found"
    els.input.value = match.text;
    showMatch(match);
  }
  els.autocomplete.addEventListener('mousedown', selectAutocompleteFromEvent);
  els.autocomplete.addEventListener('touchstart', selectAutocompleteFromEvent);

  loadTsv(app_el.getAttribute('data-tsv-path'), function() {
    els.loading.parentNode.removeChild(els.loading);

    // FIXME here be races...
    if (document.body.hasAttribute('data-search-term')) {
      els.input.focus();
      els.input.value = document.body.getAttribute('data-search-term');
      autocomplete();
      showMatch(autocompleteMatches[0]); // Assume the search matches
    } else {
      // The user typed while the page was loading
      autocomplete();
    }
  });
}

main();
