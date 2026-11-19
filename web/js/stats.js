// Thống kê: chuỗi ngày, tỉ lệ hoàn thành, đếm theo ngày, huy hiệu.
// Đầu vào là mảng ngày dạng 'YYYY-MM-DD' theo giờ máy (không dùng UTC, tránh lệch ngày ở Việt Nam).
(function (root) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');

  function dayKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseKey(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  // Chuỗi ngày liên tiếp bình thường (mọi ngày đều tính).
  // Hôm nay chưa làm thì chuỗi vẫn giữ nguyên, chỉ đứt khi qua hết hôm nay.
  function computeStreak(days, today) {
    const set = new Set(days);
    let cursor = parseKey(dayKey(today || new Date()));
    if (!set.has(dayKey(cursor))) cursor = addDays(cursor, -1);

    let current = 0;
    while (set.has(dayKey(cursor))) {
      current++;
      cursor = addDays(cursor, -1);
    }

    let longest = 0, run = 0, prev = null;
    for (const k of [...set].sort()) {
      run = prev && dayKey(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = k;
    }
    return { current, longest };
  }

  // schedule: mảng thứ được chọn theo getDay (0=Chủ nhật, 1=Thứ 2, ... 6=Thứ 7).
  // Rỗng hoặc bỏ trống = mọi ngày.
  function isScheduled(d, schedule) {
    return !schedule || schedule.length === 0 || schedule.includes(d.getDay());
  }

  // Chuỗi hiện tại và dài nhất cho thói quen có lịch theo thứ.
  // Ngày không nằm trong lịch thì bỏ qua, không làm đứt chuỗi.
  // Hôm nay chưa làm thì chưa tính là đứt.
  function habitStreak(doneDays, schedule, today) {
    const done = new Set(doneDays);
    const end = parseKey(dayKey(today || new Date()));
    const todayKey = dayKey(end);
    if (done.size === 0) return { current: 0, longest: 0 };

    const first = parseKey([...done].sort()[0]);
    let longest = 0, run = 0;
    for (let d = first; d <= end; d = addDays(d, 1)) {
      const k = dayKey(d);
      if (done.has(k)) {
        run++;
        if (run > longest) longest = run;
      } else if (isScheduled(d, schedule) && k !== todayKey) {
        run = 0;
      }
    }
    return { current: run, longest };
  }

  // Tỉ lệ hoàn thành n ngày gần nhất (chỉ tính các ngày nằm trong lịch)
  function completionRate(doneDays, schedule, n, today) {
    const done = new Set(doneDays);
    const end = parseKey(dayKey(today || new Date()));
    let total = 0, ok = 0;
    for (let i = 0; i < n; i++) {
      const d = addDays(end, -i);
      if (!isScheduled(d, schedule)) continue;
      total++;
      if (done.has(dayKey(d))) ok++;
    }
    return { done: ok, total, pct: total ? Math.round((ok / total) * 100) : 0 };
  }

  // Đếm số lần theo từng ngày: ['2026-11-05','2026-11-05'] -> { '2026-11-05': 2 }
  function tally(days) {
    const out = {};
    for (const k of days) out[k] = (out[k] || 0) + 1;
    return out;
  }

  // n ngày gần nhất (cũ -> mới), dùng cho biểu đồ tuần (n=7) và tháng (n=30)
  function lastNDays(counts, n, today) {
    const end = parseKey(dayKey(today || new Date()));
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = dayKey(addDays(end, -i));
      out.push({ key: k, count: counts[k] || 0 });
    }
    return out;
  }

  const BADGES = [
    { id: 'streak3', days: 3, name: 'Khởi động' },
    { id: 'streak7', days: 7, name: 'Một tuần đều đặn' },
    { id: 'streak30', days: 30, name: 'Một tháng bền bỉ' },
  ];

  function badgesFor(longest) {
    return BADGES.map((b) => ({ ...b, earned: longest >= b.days }));
  }

  const api = {
    dayKey, computeStreak, habitStreak, completionRate,
    tally, lastNDays, badgesFor, BADGES,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RemiStats = api;
})(typeof window !== 'undefined' ? window : globalThis);