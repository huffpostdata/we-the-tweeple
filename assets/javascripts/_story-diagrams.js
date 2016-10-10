let database = null;

function makeStoryDiagrams(newDatabase) {
  database = newDatabase;
}

document.querySelector('article').addEventListener('click', function(ev) {
  var node = ev.target;
  if (node.tagName !== 'KBD') return; // user didn't click a token

  if (database === null) return; // database not yet loaded

  var token = database.find(node.textContent);
  if (token === null) return; // typo in article -- don't crash

  console.log('Focus on token', token);
});

module.exports = makeStoryDiagrams;
