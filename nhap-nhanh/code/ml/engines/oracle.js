'use strict';
/** Trả đúng đáp án trong mẫu. Chỉ để kiểm tra chính công cụ đánh giá (phải ra 100%). */
function create() {
  return { name: 'oracle', parse: (_in, ex) => ex.output };
}
module.exports = { create };
