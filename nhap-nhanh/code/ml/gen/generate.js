'use strict';
/**
 * Sinh dữ liệu huấn luyện bằng mẫu câu do chính mình viết (không dùng đầu ra của bất kỳ AI nào),
 * nhãn đúng "theo cấu tạo": biết trước ngày giờ rồi mới viết câu, nên không có nhãn sai.
 *
 *   node ml/gen/generate.js --n 6000 --seed 1 --out ml/data/synth-train.jsonl
 *
 * Quy tắc gán nhãn nằm ở ml/README.md. Chỉ dùng dữ liệu này để dạy model cái khung, còn chất lượng thật
 * phải đo bằng ml/data/gold.jsonl (câu giống ngoài đời) và về sau là dữ liệu thật của người dùng đã đồng ý.
 */
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../../web/js/qty.js');
const { fold } = require('../../web/js/local-parse.js');
const dishes = require('../../web/data/dishes.json');
const { validateIntent } = require('../schema');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const chance = (r, p) => r() < p;
const pad = (n) => String(n).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const squash = (s) => s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim();

const SUBJECTS = ['họp với khách', 'gọi cho bố mẹ', 'đón con', 'nộp báo cáo', 'đi khám răng', 'chở vợ đi làm nail', 'tưới cây', 'thanh toán tiền điện',
  'gặp bạn', 'họp nhóm', 'đi học thêm', 'đặt vé máy bay', 'họp phụ huynh', 'gửi email cho sếp', 'sửa xe', 'giặt đồ', 'đổ rác', 'in tài liệu',
  'họp giao ban', 'ăn tối với gia đình', 'đi cắt tóc', 'dọn nhà', 'phỏng vấn ứng viên', 'đưa con đi học', 'rút tiền', 'khám sức khoẻ', 'bảo trì máy lạnh'];
const WD_NAME = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];
const wdText = (r, wd) => (wd === 0 ? 'chủ nhật' : chance(r, 0.5) ? `thứ ${wd + 1}` : WD_NAME[wd]);

/** Cách viết một giờ, đúng theo quy tắc hiểu giờ trong ml/README.md. */
function timeSurface(r, h, mi, shopping, dayPod) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = pad(mi);
  const hm = (x) => (mi ? `${x}h${mm}` : `${x}h`);
  const gio = (x) => (mi ? `${x} giờ ${mm}` : `${x} giờ`);
  const f = [];
  if (dayPod && h !== 12) return pick(r, [hm(h12), gio(h12)]); // "tối mai 7h": từ chỉ buổi đã nằm ở phần ngày
  if (h >= 6 && h <= 11) { f.push(hm(h) + ' sáng', gio(h) + ' sáng', 'sáng ' + hm(h)); if (!shopping) f.push(hm(h), gio(h)); }
  if (h === 12) f.push(hm(12) + ' trưa', hm(12), gio(12) + ' trưa');
  if (h >= 13 && h <= 17) f.push(hm(h12) + ' chiều', gio(h12) + ' chiều', hm(h12), hm(h));
  if (h >= 18 && h <= 23) { f.push(hm(h12) + ' tối', gio(h12) + ' tối', 'tối ' + hm(h12), hm(h)); if (shopping && h <= 21) f.push(hm(h12)); }
  if (h >= 13) f.push(`${h}:${mm}`);
  return pick(r, f);
}

/** Chọn cách nói ngày; trả về ngày thật theo quy tắc: không nói ngày thì hôm nay nếu giờ còn chưa qua, không thì ngày mai. */
function pickDay(r, now, h, mi, kinds) {
  const today = midnight(now);
  const at = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi);
  let k = pick(r, kinds);
  if (k === 'homnay' && at(today) <= now) k = 'mai';
  switch (k) {
    case 'none': return { text: '', date: at(today) <= now ? addDays(today, 1) : today, pod: null, kind: k };
    case 'homnay': return { text: h >= 18 ? 'tối nay' : h >= 12 ? (h === 12 ? 'hôm nay' : 'chiều nay') : 'sáng nay', date: today, pod: h >= 18 || (h >= 13 && h < 18) || h < 12 ? (h >= 18 ? 'toi' : h >= 13 ? 'chieu' : 'sang') : null, kind: k };
    case 'mai': {
      const pod = h < 12 ? 'sáng' : h >= 18 ? 'tối' : h >= 13 ? 'chiều' : null;
      const text = pod && chance(r, 0.5) ? `${pod} mai` : pick(r, ['mai', 'ngày mai']);
      return { text, date: addDays(today, 1), pod: pod && text === `${pod} mai` ? pod : null, kind: k };
    }
    case 'kia': return { text: 'ngày kia', date: addDays(today, 2), pod: null, kind: k };
    case 'thu': {
      const wd = int(r, 0, 6);
      let diff = (wd - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return { text: wdText(r, wd), date: addDays(today, diff), pod: null, kind: k, wd };
    }
    case 'tuansau': {
      const wd = int(r, 0, 6);
      const nextMon = addDays(today, (8 - today.getDay()) % 7 || 7);
      return { text: wdText(r, wd) + ' tuần sau', date: addDays(nextMon, wd === 0 ? 6 : wd - 1), pod: null, kind: k, wd };
    }
    default: {
      const d = addDays(today, int(r, 3, 40));
      const sameMonth = d.getMonth() === today.getMonth() && d.getDate() > today.getDate();
      return { text: sameMonth && chance(r, 0.4) ? `ngày ${d.getDate()}` : `ngày ${d.getDate()}/${d.getMonth() + 1}`, date: d, pod: null, kind: 'ngay' };
    }
  }
}

const LEADS = [['15 phút', 15], ['30 phút', 30], ['45 phút', 45], ['1 tiếng', 60], ['2 tiếng', 120], ['1 tiếng rưỡi', 90], ['10 phút', 10]];
const LEAD_FRAMES = ['nhắc trước {X}', 'báo trước {X}', 'nhắc tôi trước {X}', 'nhắc trước tôi {X}'];

function randomNow(r) {
  const base = new Date(2026, 0, 1);
  const d = addDays(base, int(r, 0, 700));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), int(r, 5, 22), pick(r, [0, 5, 10, 15, 20, 30, 40, 45, 50]));
}

function taskExample(r, now) {
  const subj = pick(r, SUBJECTS);
  const h = int(r, 6, 22), mi = pick(r, [0, 0, 0, 0, 15, 30, 30, 45]);
  const weekly = chance(r, 0.08), daily = !weekly && chance(r, 0.08);
  const day = pickDay(r, now, h, mi, weekly ? ['thu'] : ['none', 'none', 'homnay', 'mai', 'mai', 'kia', 'thu', 'thu', 'tuansau', 'ngay']);
  const tt = timeSurface(r, h, mi, false, day.pod);
  let dt = day.text;
  if (weekly && day.kind === 'thu') dt = 'mỗi ' + day.text;
  let s = pick(r, [
    `${dt} ${tt} ${subj}`, `${subj} lúc ${tt} ${dt}`, `nhắc tôi ${subj} ${dt} lúc ${tt}`, `${subj} ${dt} ${tt}`,
    `${dt} lúc ${tt} ${subj}`, `nhắc ${subj} ${tt} ${dt}`, `nhớ ${subj} ${tt} ${dt}`, `${tt} ${dt} ${subj}`,
  ]);
  if (weekly && day.kind !== 'thu') s += ' hằng tuần';
  if (daily) s += ' ' + pick(r, ['mỗi ngày', 'hằng ngày']);
  let lead = 0;
  if (chance(r, 0.3)) { const [x, m] = pick(r, LEADS); lead = m; s += ', ' + pick(r, LEAD_FRAMES).replace('{X}', x); }
  const when = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), h, mi);
  return {
    family: weekly || daily ? 'repeat' : 'task', text: s,
    out: { intent: 'task', title: cap(subj), emoji: '📌', when: iso(when), repeat: weekly ? 'weekly' : daily ? 'daily' : 'none', leadMinutes: lead, shopping: false, servings: 4, checklist: [] },
    expect: { title: subj },
  };
}

function shoppingExample(r, now) {
  const dish = chance(r, 0.8) ? pick(r, dishes) : null;
  const h = int(r, 15, 20), mi = pick(r, [0, 0, 0, 30]);
  const day = pickDay(r, now, h, mi, ['none', 'homnay', 'mai', 'mai', 'thu']);
  const tt = timeSurface(r, h, mi, true, day.pod);
  const dt = day.text;
  let text, servings = 4, out;
  if (dish) {
    const surf = pick(r, [dish.name].concat(dish.aliases || []));
    if (chance(r, 0.5)) servings = int(r, 2, 8);
    const forN = servings !== 4 || chance(r, 0.15) ? `cho ${servings} người` : '';
    text = pick(r, [`đi chợ nấu ${surf} ${forN} ${tt} ${dt}`, `vợ nhờ tôi đi chợ nấu ${surf} ${forN} ${tt} ${dt}`, `nhớ đi chợ nấu ${surf} ${forN} lúc ${tt} ${dt}`, `${dt} ${tt} đi chợ nấu ${surf} ${forN}`]);
    out = { title: `Đi chợ nấu ${surf}`, checklist: dish.items.map((x) => ({ item: x.item, qty: Q.scaleQty(x.qty, servings / (dish.servings || 4)) })) };
  } else {
    const what = pick(r, ['đi chợ', 'đi siêu thị']);
    text = pick(r, [`${what} ${tt} ${dt}`, `${dt} ${tt} ${what}`, `nhớ ${what} lúc ${tt} ${dt}`]);
    out = { title: cap(what), checklist: [] };
  }
  let lead = 60;
  if (chance(r, 0.2)) { const [x, m] = pick(r, LEADS); lead = m; text += ', ' + pick(r, LEAD_FRAMES).replace('{X}', x); }
  const when = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), h, mi);
  return {
    family: 'shopping', text,
    out: { intent: 'task', title: out.title, emoji: '🛒', when: iso(when), repeat: 'none', leadMinutes: lead, shopping: true, servings, checklist: out.checklist },
    expect: { title: out.title.toLowerCase() },
  };
}

const OTHER_HABITS = [
  ['đi bộ', 'Đi bộ', '🏃', 'phút', [15, 20, 30, 45]], ['chạy bộ', 'Chạy bộ', '🏃', 'km', [2, 3, 5]], ['giãn cơ', 'Giãn cơ', '🧘', 'phút', [5, 10]],
  ['đọc sách', 'Đọc sách', '📖', 'trang', [10, 20, 30]], ['thiền', 'Thiền', '🧘', 'phút', [5, 10, 15]], ['tập yoga', 'Tập yoga', '🧘', 'phút', [20, 30, 45]],
  ['hít đất', 'Hít đất', '💪', 'cái', [10, 20, 30]], ['uống vitamin', 'Uống vitamin', '💊', null, []],
];
const REPEATS = [
  { t: 'mỗi ngày', days: [0, 1, 2, 3, 4, 5, 6], time: '07:00' }, { t: 'mỗi sáng', days: [0, 1, 2, 3, 4, 5, 6], time: '07:00' },
  { t: 'mỗi trưa', days: [0, 1, 2, 3, 4, 5, 6], time: '12:00' }, { t: 'mỗi chiều', days: [0, 1, 2, 3, 4, 5, 6], time: '17:00' },
  { t: 'mỗi tối', days: [0, 1, 2, 3, 4, 5, 6], time: '21:00' }, { t: 'cuối tuần', days: [6, 0], time: '07:00' }, { t: 'ngày thường', days: [1, 2, 3, 4, 5], time: '07:00' },
];
const lit = (L) => String(L).replace('.', ',');

function habitExample(r) {
  const kind = pick(r, ['water1', 'water1', 'water2', 'other', 'other', 'other']);
  if (kind === 'water1' || kind === 'water2') {
    const L = pick(r, [1, 1.5, 2, 2.5, 3]);
    const Ls = chance(r, 0.5) ? lit(L) : String(L);
    const count = Math.ceil((L * 1000) / 250);
    if (kind === 'water1') {
      const text = pick(r, [`uống nước ${Ls} lít mỗi ngày`, `uống đủ ${Ls} lít nước mỗi ngày`, `nhắc tôi uống nước ${Ls} lít hằng ngày`]);
      return { family: 'habit', text, out: { intent: 'habit', title: `Uống nước ${lit(L)} lít`, emoji: '💧', habit: { recurring: true, times: [], days: [0, 1, 2, 3, 4, 5, 6], spread: { count, from: 'wake', to: 'bed' } } }, expect: { title: 'uống nước' } };
    }
    const h = int(r, 8, 11);
    const text = pick(r, [`nhắc tôi uống nước từ bây giờ đến ${h}h tối đủ ${Ls} lít`, `uống nước từ đây đến ${h}h tối đủ ${Ls} lít`]);
    return { family: 'habit', text, out: { intent: 'habit', title: `Uống nước ${lit(L)} lít`, emoji: '💧', habit: { recurring: false, times: [], days: [0, 1, 2, 3, 4, 5, 6], spread: { count, from: 'now', to: `${h + 12}:00` } } }, expect: { title: 'uống nước' } };
  }
  const [surf, canon, emoji, unit, nums] = pick(r, OTHER_HABITS);
  const n = unit ? pick(r, nums) : null;
  const qty = unit ? ` ${n} ${unit}` : '';
  let rep, days, time;
  if (chance(r, 0.25)) {
    const set = new Set();
    const want = int(r, 2, 3);
    while (set.size < want) set.add(int(r, 2, 7));
    const nums2 = [...set].sort((a, b) => a - b);
    rep = 'thứ ' + nums2.join(', ');
    days = nums2.map((x) => x - 1);
    time = '07:00';
  } else { const x = pick(r, REPEATS); rep = x.t; days = x.days; time = x.time; }
  let text = `${surf}${qty} ${rep}`;
  if (chance(r, 0.4)) {
    const h = int(r, 6, 22), mi = pick(r, [0, 0, 30]);
    text += ' lúc ' + timeSurface(r, h, mi, false, null);
    time = `${pad(h)}:${pad(mi)}`;
  }
  return { family: 'habit', text, out: { intent: 'habit', title: canon + qty, emoji, habit: { recurring: true, times: [time], days, spread: null } }, expect: { title: (canon + qty).toLowerCase() } };
}

function noise(r, text) {
  let s = text;
  if (chance(r, 0.2)) s = fold(s);
  if (chance(r, 0.1)) s += ' ' + pick(r, ['nha', 'nhé', 'nhen']);
  if (chance(r, 0.1)) s = cap(s);
  return s;
}

function toExpect(ex) {
  const o = ex.out, e = { intent: o.intent, title: ex.expect.title };
  if (o.intent === 'task') {
    Object.assign(e, { when: o.when, repeat: o.repeat, leadMinutes: o.leadMinutes, shopping: o.shopping });
    if (o.shopping) { e.servings = o.servings; if (o.checklist.length) { e.items = o.checklist.map((x) => x.item); e.qty = Object.fromEntries(o.checklist.map((x) => [x.item, x.qty])); } }
  } else {
    e.habit = o.habit;
  }
  return e;
}

function generate(n, seed) {
  const r = rng(seed);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const now = randomNow(r);
    const p = r();
    const ex = p < 0.5 ? taskExample(r, now) : p < 0.72 ? shoppingExample(r, now) : habitExample(r);
    const errs = validateIntent(Object.assign({ assumption: '', summary: '', tips: [] }, ex.out));
    if (errs.length) throw new Error('nhãn sinh ra không hợp lệ: ' + errs.join('; ') + ' ← ' + ex.text);
    rows.push({ id: `s${seed}-${i}`, family: ex.family, input: noise(r, squash(ex.text)), now: iso(now), output: ex.out, expect: toExpect(ex) });
  }
  return rows;
}

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? a.concat([[x.slice(2), all[i + 1]]]) : a), []));
  const n = Number(args.n || 5000), seed = Number(args.seed || 1);
  const rows = generate(n, seed);
  const out = args.out || path.join(__dirname, '..', 'data', `synth-${seed}.jsonl`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(`Đã sinh ${rows.length} mẫu → ${out}`);
}

module.exports = { generate, rng };
