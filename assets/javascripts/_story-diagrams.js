var renderVenn = require('./_venn');

var database = null;
var onFocusToken = null;
var popupEl = document.createElement('div');
popupEl.className = 'popup';

document.body.insertBefore(popupEl, document.body.childNodes[0]);

function makeStoryDiagrams(newDatabase, newOnFocusToken) {
  database = newDatabase;
  onFocusToken = newOnFocusToken;
}

function focusOnToken(token, el) {
  onFocusToken(token);

  var vennHtml = renderVenn(Math.max(token.group.nClinton, token.group.nTrump), token).html;
  popupEl.innerHTML = [
    '<div class="popup-inner">',
      '<div class="buttons">',
        '<button class="bN facebook-share"></button>',
        '<button class="bN twitter-share"></button>',
        '<div class="space"></div>',
        '<button class="close">×</button>',
      '</div>',
      '<div class="venn-outer">', vennHtml, '</div>',
    '</div>'
  ].join('');
  popupEl.classList.add('show');
}

popupEl.addEventListener('click', function(ev) {
  if (ev.target === popupEl /* it's the background */ || ev.target.className === 'close' /* it's the close button */) {
    popupEl.classList.remove('show');
  }
});

document.addEventListener('keydown', function(ev) {
  if (ev.keyCode === 27) {
    popupEl.classList.remove('show');
  }
});

document.querySelector('article').addEventListener('click', function(ev) {
  var node = ev.target;
  if (node.tagName !== 'KBD') return; // user didn't click a token

  if (database === null) return; // database not yet loaded

  var token = database.find(node.textContent);
  if (token === null) return; // typo in article -- don't crash

  focusOnToken(token);
});

module.exports = makeStoryDiagrams;
