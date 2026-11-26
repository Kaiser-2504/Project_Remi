/* Form trang /lien-he: kiểm tra từng trường, báo lỗi tại chỗ, gửi POST /api/contact. */
'use strict';
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const status = $('c-status');
  const msg = $('c-message');
  const btn = form.querySelector('button[type="submit"]');

  function check() {
    const v = {
      name: $('c-name').value.trim(),
      email: $('c-email').value.trim(),
      topic: $('c-topic').value,
      message: msg.value.trim(),
    };
    const e = {};
    if (!v.name) e.name = 'Nhập tên của bạn.';
    else if (v.name.length > 60) e.name = 'Tên tối đa 60 ký tự.';
    if (!EMAIL_RE.test(v.email)) e.email = 'Email chưa đúng, ví dụ ban@gmail.com.';
    if (v.message.length < 10) e.message = 'Viết ít nhất 10 ký tự để nhóm hiểu rõ.';
    else if (v.message.length > 2000) e.message = 'Tối đa 2000 ký tự.';
    return { v, e };
  }

  function show(errors) {
    ['name', 'email', 'topic', 'message'].forEach((k) => {
      const el = $('c-' + k), out = $('e-' + k);
      out.textContent = errors[k] || '';
      el.setAttribute('aria-invalid', errors[k] ? 'true' : 'false');
    });
    const first = ['name', 'email', 'topic', 'message'].find((k) => errors[k]);
    if (first) $('c-' + first).focus();
  }

  msg.addEventListener('input', () => { $('c-count').textContent = msg.value.length + ' / 2000'; });
  form.addEventListener('input', (ev) => {
    // Đã báo lỗi thì kiểm tra lại ngay khi người dùng sửa
    const k = ev.target.name;
    if (k && $('e-' + k).textContent) { const { e } = check(); $('e-' + k).textContent = e[k] || ''; ev.target.setAttribute('aria-invalid', e[k] ? 'true' : 'false'); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const { v, e } = check();
    show(e);
    if (Object.keys(e).length) { status.textContent = ''; return; }
    btn.disabled = true;
    status.textContent = 'Đang gửi...';
    status.className = 'form-status';
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Remi': '1' }, body: JSON.stringify(v), credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        form.reset();
        $('c-count').textContent = '0 / 2000';
        status.textContent = 'Đã gửi. Cảm ơn bạn, nhóm sẽ đọc sớm!';
        status.className = 'form-status ok';
        if (window.remiTrack) window.remiTrack('contact_sent', { topic: v.topic });
      } else {
        if (j.errors) show(j.errors);
        status.textContent = j.message || 'Gửi chưa được, thử lại sau nhé.';
        status.className = 'form-status bad';
      }
    } catch (x) {
      status.textContent = 'Mất kết nối, kiểm tra mạng rồi thử lại.';
      status.className = 'form-status bad';
    } finally {
      btn.disabled = false;
    }
  });
})();
