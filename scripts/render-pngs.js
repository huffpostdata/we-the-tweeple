// import

const _ = require('lodash');
const fs = require('fs-extra');
const Database = require('../app/Database.js');

// config

const db = new Database();

// benchmark

console.time('10k');

db.biggestTokens.forEach((token) => {
  token.renderPng();
});

console.timeEnd('10k');
