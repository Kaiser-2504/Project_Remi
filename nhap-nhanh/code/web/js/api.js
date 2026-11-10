/* Lớp gọi API rất mỏng: cookie phiên tự đi kèm, mọi yêu cầu ghi có header X-Remi (chống CSRF). */
(function () {
  'use strict';
  async function call(method, path, body) {
    let r;
    try {
      r = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Remi': '1' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      const err = new Error('Không kết nối được máy chủ.');
      err.network = true;
      throw err;
    }
    let data = null;
    try { data = await r.json(); } catch (e) { /* không có thân JSON */ }
    if (!r.ok) {
      const err = new Error((data && data.message) || 'Có lỗi xảy ra, thử lại nhé.');
      err.status = r.status;
      err.code = data && data.error;
      err.data = data;
      throw err;
    }
    return data;
  }
  window.RemiAPI = {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b || {}),
    put: (p, b) => call('PUT', p, b),
    del: (p, b) => call('DELETE', p, b || {}),
  };
})();
