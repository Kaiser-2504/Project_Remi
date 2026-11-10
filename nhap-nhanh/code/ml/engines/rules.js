'use strict';
const { createParser } = require('../../web/js/local-parse.js');
const dishes = require('../../web/data/dishes.json');

/** Bộ hiểu câu theo luật chạy trên máy (web/js/local-parse.js). Dùng làm mốc để model tự huấn luyện phải vượt. */
function create() {
  const p = createParser(dishes);
  return { name: 'rules', parse: ({ text, now }) => p.parse(text, now) };
}
module.exports = { create };
