'use strict';
/** Không trả gì. Chỉ để kiểm tra công cụ đánh giá (phải ra 0%). */
function create() {
  return { name: 'null', parse: () => ({}) };
}
module.exports = { create };
