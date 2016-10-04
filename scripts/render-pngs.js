// import

const fs = require('fs-extra');
const async = require('async');
const Database = require('../app/Database.js');

// config

const db = new Database();

// sync benchmark - 26m

console.time('10k-sync');

db.biggestTokens.forEach((token) => {
  token.renderPng();
});

console.timeEnd('10k-sync');

// async benchmark - 26m

console.time('10k-async');

// async.forEach(db.biggestTokens, (token, next) => {
//   token.renderPng();
//   next();
// }, () => {
//   console.timeEnd('10k-async');
// });
