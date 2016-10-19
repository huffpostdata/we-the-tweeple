let database = null;
let onFocusToken = null;

function makeStoryDiagrams(newDatabase, newOnFocusToken) {
  database = newDatabase;
  onFocusToken = newOnFocusToken;
}

function focusOnToken(token, el) {
}

document.querySelector('article').addEventListener('click', function(ev) {
  var node = ev.target;
  if (node.tagName !== 'KBD') return; // user didn't click a token

  if (database === null) return; // database not yet loaded

  var token = database.find(node.textContent);
  if (token === null) return; // typo in article -- don't crash

  onFocusToken(token);
});

module.exports = makeStoryDiagrams;
