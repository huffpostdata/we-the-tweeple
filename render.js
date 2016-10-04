// import

const _ = require('lodash');
const fs = require('fs-extra');
const Database = require('./app/Database.js');

// config

const db = new Database();

// render

_.forEach(db.renderBiggestPngs(), (buffer, token) => {
  fs.outputFileSync(`./output/${token}.png`, buffer);
});
