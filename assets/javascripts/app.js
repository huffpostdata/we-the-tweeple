var renderVenn = require('./_venn');
var Database = require('./_database');
var formatInt = require('./_format-int');

var RootPath = '/2016/we-the-tweeple';  // XXX autocomplete this?

var nClintonTotal = 3103739; // TK adjust this -- num with bios
var nTrumpTotal = 3926005; // TK adjust this -- num with bios
var nBothTotal = 747171; // TK adjust this -- num with bios

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
              '<span class="n">', formatInt(m.groupN), '</span>',
              renderVenn(maxN, m.group.nClinton, m.group.nTrump, m.group.nBoth).svg,
            '</a></li>'
          ].join('');
        }).join('')
        + '</ul>';

      if (autocompleteMatches[0] === prefix || autocompleteMatches.length === 1) {
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

      var variantsHtml = '';
      if (group.nVariants > 1) {
        var liHtmls = group.tokens
          .filter(function(t) { return t != token; })
          .slice(0, 2)
          .map(function(token) {
            return '<li><q>' + html_escape(token.text) + '</q><span class="n">' + formatInt(token.n) + '</span></li>';
          });
        var nOther = group.nVariants - liHtmls.length - 1;
        if (nOther > 0) {
          if (nOther === 1) {
            liHtmls.push('<li class="other">1 similar spelling</li>');
          } else {
            liHtmls.push('<li class="other">' + nOther + ' similar spellings</li>');
          }
        }
        variantsHtml = [
          '<div class="variants">',
            'Includes <ul>', liHtmls.join(''), '</ul>',
          '</div>'
        ].join('');
      }

      var venn = renderVenn(group.n, group.nClinton, group.nTrump, group.nBoth);
      var m = venn.measurements;

      var leftPercent = 100 - 25 * (2 + m.clinton.x + m.clinton.r);
      var rightPercent = 100 - 25 * (2 + m.trump.x + m.trump.r);
      var centerPercent = (leftPercent + 100 - rightPercent) / 2;

      var sentenceHTML = null;
      if (group.nClinton === 0 || group.nTrump === 0) {
        var winner = group.nClinton > 0 ? 'Clinton' : 'Trump';
        sentenceHTML = [
          '<h4 class="', winner.toLowerCase(), '">',
            'Only <strong class="winner">', winner, '</strong> followers use the phrase ',
            '<q>', html_escape(token.text), '</q>',
          '</h4>'
        ].join('');
      } else {
        var fClinton = group.nClinton / nClintonTotal;
        var fTrump = group.nTrump / nTrumpTotal;
        var winPercent = Math.round(100 * Math.abs(fClinton - fTrump) / Math.min(fClinton, fTrump));
        if (winPercent === 0) {
          sentenceHTML = [
            '<h4 class="tie">Clinton and Trump followers use the phrase ',
            '<q>', html_escape(token.text), '</q> in equal proportions</h4>'
          ].join('');
        } else {
          var winner = fClinton > fTrump ? 'Clinton' : 'Trump';
          var loser = fClinton < fTrump ? 'Clinton' : 'Trump';
          sentenceHTML = [
            '<h4 class="', winner.toLowerCase(), '">',
              '<strong class="winner">', winner, '</strong> followers are ',
              '<strong class="likely">', formatInt(winPercent), '% more likely to use the phrase ',
              '<q>', html_escape(token.text), '</q> than ',
              '<strong class="loser">', loser, '</strong> followers',
            '</h4>'
          ].join('');
        }
      }

      els.result.innerHTML = [
        variantsHtml,
        '<figure class="venn-container" style="margin-left: ', (50 - centerPercent), '%; margin-right: ', (centerPercent - 50), '%;">',
          '<h3 style="left: ', leftPercent, '%; right: ', rightPercent, '%;">',
            '<strong>', formatInt(group.n), '</strong>',
            '<span>followers used <q>', html_escape(token.text), '</q> in their Twitter bios</span>',
          '</h3>',
          venn.svg,
          '<div class="only-clinton" style="right: ', (100 - leftPercent), '%;">',
            '<em>', formatInt(group.nOnlyClinton), '</em> ',
            '<span>', (group.nOnlyClinton === 1 ? 'follows' : 'follow'), ' only Clinton</span>',
          '</div>',
          '<div class="only-trump" style="left: ', (100 - rightPercent), '%;">',
            '<em>', formatInt(group.nOnlyTrump), '</em> ',
            '<span>', (group.nOnlyTrump === 1 ? 'follows' : 'follow'), ' only Trump</span>',
          '</div>',
          '<div class="both" style="width: 75%; left: ', (25 * (2 + m.x) - 37.5), '%; top: ', (50 * (1 + m.y)), '%;">',
            '<em>', formatInt(group.nBoth), '</em>',
            '<span>', (group.nBoth === 1 ? 'follows' : 'follow'), ' both</span>',
          '</div>',
        '</figure>',
        '<h4>', 
        sentenceHTML
      ].join('');

      els.resultContainer.appendChild(els.result);
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
