'use strict';
/* Nhóm B: thực đơn tuần và tủ đồ nhà (web/js/kitchen.js). Mọi test dùng ngày cố định, không phụ thuộc giờ chạy. */
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../web/js/kitchen.js');
const DISHES = require('../../web/data/dishes.json');

const LIB = K.libraryFrom(DISHES);
const byName = (n) => LIB.find((d) => K.normName(d.name) === K.normName(n));
const TODAY = '2026-11-11'; // thứ tư

/* ---------- ngày và tuần ---------- */
test('tuần bắt đầu từ thứ hai, kể cả khi hôm nay là chủ nhật', () => {
  assert.equal(K.weekStart('2026-11-11'), '2026-11-09'); // thứ tư -> thứ hai cùng tuần
  assert.equal(K.weekStart('2026-11-09'), '2026-11-09'); // thứ hai giữ nguyên
  assert.equal(K.weekStart('2026-11-15'), '2026-11-09'); // chủ nhật thuộc tuần trước đó, không phải tuần sau
  assert.equal(K.weekdayOf('2026-11-15'), 0);
});

test('cộng ngày qua tháng, qua năm, năm nhuận', () => {
  assert.equal(K.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(K.addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(K.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(K.addDays('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(K.weekDays('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(K.daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.throws(() => K.addDays('11/11/2026', 1));
});

test('chọn bữa theo giờ trong ngày', () => {
  assert.equal(K.slotForHour(6), 'sang');
  assert.equal(K.slotForHour(9), 'sang');
  assert.equal(K.slotForHour(10), 'trua');
  assert.equal(K.slotForHour(14), 'trua');
  assert.equal(K.slotForHour(15), 'toi');
  assert.equal(K.slotForHour(23), 'toi');
  assert.deepEqual(K.parseMealKey('2026-11-11|toi'), { date: '2026-11-11', slot: 'toi' });
  assert.equal(K.parseMealKey('2026-11-11|khuya'), null);
  assert.equal(K.parseMealKey('hom-nay|toi'), null);
});

/* ---------- định lượng ---------- */
test('quy đổi đơn vị về gốc để cộng được', () => {
  assert.deepEqual(K.toBase('1,5 kg'), { n: 1500, dim: 'g', label: 'g' });
  assert.deepEqual(K.toBase('200 ml'), { n: 200, dim: 'ml', label: 'ml' });
  assert.equal(K.toBase('1 lít').n, 1000);
  assert.equal(K.toBase('3 củ').dim, 'u:cu');
  assert.equal(K.toBase('3 Củ').dim, 'u:cu', 'viết hoa vẫn là một đơn vị');
  assert.equal(K.toBase('2 muỗng').spoon, true);
  assert.equal(K.toBase('một ít'), null);
  assert.equal(K.toBase(''), null);
});

test('viết lượng cho dễ đọc', () => {
  assert.equal(K.fmtAmount(1300, 'g', 'g'), '1,3 kg');
  assert.equal(K.fmtAmount(950, 'g', 'g'), '950 g');
  assert.equal(K.fmtAmount(1500, 'ml', 'ml'), '1,5 lít');
  assert.equal(K.fmtAmount(2, 'u:cu', 'củ'), '2 củ');
  assert.equal(K.fmtAmount(1.5, 'u:muong', 'muỗng'), '1,5 muỗng');
});

test('cộng lượng khác đơn vị: gram cộng kg, củ giữ riêng, chữ tự do giữ nguyên', () => {
  const a = K.newAmount();
  K.addAmount(a, '600 g');
  K.addAmount(a, '0,7 kg');
  K.addAmount(a, '2 củ');
  K.addAmount(a, 'một ít');
  K.addAmount(a, 'một ít'); // không lặp lại ghi chú
  assert.equal(K.amountText(a), '1,3 kg + 2 củ + một ít');
});

test('làm tròn LÊN để mua đủ', () => {
  const a = K.newAmount();
  K.addAmount(a, '3 củ', 0.5);         // 1,5 củ -> mua 2 củ
  K.addAmount(a, '600 g', 1 / 3);      // 200 g
  K.addAmount(a, '1 muỗng', 0.6);      // 0,6 muỗng -> 1 muỗng (bước nửa muỗng)
  assert.equal(K.amountText(a), '200 g + 2 củ + 1 muỗng');
  const b = K.newAmount();
  K.addAmount(b, '101 g');
  assert.equal(K.amountText(b), '105 g');
  assert.equal(K.amountText(b, { round: false }), '101 g');
});

/* ---------- kho món ---------- */
test('món có sẵn đọc từ dishes.json, mã món ổn định và viết hoa đầu', () => {
  assert.equal(LIB.length, DISHES.length);
  const c = byName('cà ri gà');
  assert.equal(c.id, 'lib:ca ri ga');
  assert.equal(c.name, 'Cà ri gà');
  assert.equal(c.servings, 4);
  assert.ok(c.items.length >= 5);
});

test('món của tôi đứng trước món có sẵn, tìm được theo tên không dấu, tên gọi khác và nguyên liệu', () => {
  const mine = { id: 'my1', name: 'canh rau ngót', servings: 2, items: [{ item: 'Rau ngót', qty: '1 bó' }] };
  const all = K.allDishes(LIB, [mine]);
  assert.equal(all[0].id, 'my1');
  assert.equal(all[0].mine, true);
  assert.equal(all[0].name, 'Canh rau ngót');
  assert.deepEqual(K.searchDishes(all, 'ca ri').map((d) => d.name), ['Cà ri gà']);
  assert.ok(K.searchDishes(all, 'cari').some((d) => d.name === 'Cà ri gà'), 'tên gọi khác');
  assert.ok(K.searchDishes(all, 'rau ngot').some((d) => d.id === 'my1'), 'tìm theo nguyên liệu');
  assert.equal(K.searchDishes(all, '').length, all.length);
});

test('kiểm tra món tự tạo trước khi lưu', () => {
  assert.match(K.validateRecipe({ name: '  ', items: [{ item: 'a' }], servings: 4 }), /tên/);
  assert.match(K.validateRecipe({ name: 'Bánh', items: [{ item: '  ', qty: '1' }], servings: 4 }), /nguyên liệu/);
  assert.match(K.validateRecipe({ name: 'Bánh', items: [{ item: 'Bột' }], servings: 0 }), /1 đến 20/);
  assert.match(K.validateRecipe({ name: 'x'.repeat(61), items: [{ item: 'Bột' }], servings: 2 }), /dài/);
  assert.equal(K.validateRecipe({ name: 'Bánh', items: [{ item: 'Bột', qty: '200 g' }], servings: 2 }), '');
});

/* ---------- thực đơn tuần ---------- */
test('thêm món vào bữa: trùng món thì cộng số người, tối đa 6 món một bữa', () => {
  const cari = byName('cà ri gà');
  let r = K.addMeal({}, TODAY, 'toi', cari, 4);
  assert.deepEqual(r.meals['2026-11-11|toi'], [{ d: 'lib:ca ri ga', n: 'Cà ri gà', s: 4 }]);
  r = K.addMeal(r.meals, TODAY, 'toi', cari, 2);
  assert.equal(r.meals['2026-11-11|toi'].length, 1);
  assert.equal(r.meals['2026-11-11|toi'][0].s, 6);
  let m = {};
  LIB.slice(0, 7).forEach((d) => { m = K.addMeal(m, TODAY, 'trua', d, 4).meals; });
  assert.equal(m['2026-11-11|trua'].length, 6);
  assert.equal(K.addMeal(m, TODAY, 'trua', LIB[8], 4).added, false);
});

test('bỏ món: bữa trống thì xoá hẳn khoá, không để mảng rỗng', () => {
  const m = K.addMeal({}, TODAY, 'toi', byName('cà ri gà'), 4).meals;
  const out = K.removeMeal(m, TODAY, 'toi', 0);
  assert.equal('2026-11-11|toi' in out, false);
  assert.ok('2026-11-11|toi' in m, 'không sửa đối tượng gốc');
});

test('chép tuần trước chỉ điền bữa còn trống', () => {
  let m = K.addMeal({}, '2026-11-02', 'toi', byName('cà ri gà'), 4).meals;
  m = K.addMeal(m, '2026-11-03', 'trua', byName('bún chả'), 2).meals;
  m = K.addMeal(m, '2026-11-09', 'toi', byName('phở bò'), 4).meals;     // tuần này thứ hai tối đã có món
  const r = K.copyWeek(m, '2026-11-02', '2026-11-09');
  assert.equal(r.count, 1);
  assert.equal(r.meals['2026-11-09|toi'][0].n, 'Phở bò', 'không đè bữa đã có');
  assert.equal(r.meals['2026-11-10|trua'][0].n, 'Bún chả');
  assert.equal(r.meals['2026-11-10|trua'][0].s, 2);
});

test('xoá tuần chỉ xoá đúng 7 ngày đó', () => {
  let m = K.addMeal({}, '2026-11-08', 'toi', byName('cà ri gà'), 4).meals;       // chủ nhật tuần trước
  m = K.addMeal(m, '2026-11-15', 'toi', byName('cà ri gà'), 4).meals;            // chủ nhật tuần này
  const out = K.clearWeek(m, '2026-11-09');
  assert.deepEqual(Object.keys(out), ['2026-11-08|toi']);
});

test('gộp nguyên liệu cả tuần: cùng nguyên liệu ở nhiều món cộng dồn và co giãn theo số người', () => {
  let m = K.addMeal({}, '2026-11-09', 'toi', byName('cà ri gà'), 4).meals;    // Thịt gà 600 g, Hành tây 1 củ
  m = K.addMeal(m, '2026-11-10', 'toi', byName('gà rang gừng'), 2).meals;      // Thịt gà 700 g x 2/4 = 350 g
  m = K.addMeal(m, '2026-11-11', 'trua', byName('bò xào hành tây'), 4).meals;  // Hành tây 2 củ
  m = K.addMeal(m, '2026-11-20', 'toi', byName('phở bò'), 4).meals;            // tuần sau: không tính
  const entries = K.weekEntries(m, '2026-11-09');
  assert.equal(entries.length, 3);
  const { items, missing } = K.aggregate(entries, K.dishIndex(LIB, []));
  assert.deepEqual(missing, []);
  const get = (n) => items.find((x) => x.key === K.normName(n));
  assert.equal(get('thịt gà').text, '950 g');
  assert.deepEqual(get('thịt gà').dishes, ['Cà ri gà', 'Gà rang gừng']);
  assert.equal(get('hành tây').text, '3 củ');
  assert.equal(get('Gừng').text, '25 g');
  assert.equal(get('bánh phở'), undefined, 'món tuần sau không lọt vào');
  // danh sách sắp theo tên tiếng Việt
  const names = items.map((x) => x.item);
  assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b, 'vi')));
});

test('món đã bị xoá khỏi "Món của tôi" vẫn hiện tên trong báo cáo thiếu, không làm hỏng danh sách', () => {
  const entries = [{ d: 'my-da-xoa', n: 'Bánh xèo', s: 4 }, { d: byName('cà ri gà').id, n: 'Cà ri gà', s: 4 }];
  const { items, missing } = K.aggregate(entries, K.dishIndex(LIB, []));
  assert.deepEqual(missing, ['Bánh xèo']);
  assert.ok(items.length > 0);
});

test('món của tôi dùng đơn vị kg vẫn cộng đúng với món có sẵn dùng g', () => {
  const mine = { id: 'my2', name: 'Gà luộc', servings: 4, items: [{ item: 'thịt gà', qty: '1 kg' }] };
  const idx = K.dishIndex(LIB, [mine]);
  const { items } = K.aggregate([{ d: 'my2', s: 4 }, { d: byName('cà ri gà').id, s: 4 }], idx);
  assert.equal(items.find((x) => x.key === 'thit ga').text, '1,6 kg');
});

/* ---------- tủ đồ và hạn dùng ---------- */
test('tình trạng hạn dùng so với hôm nay', () => {
  const st = (exp) => K.expiryStatus({ exp }, TODAY);
  assert.deepEqual(st('2026-11-10'), { level: 'expired', days: -1, text: 'Hết hạn hôm qua' });
  assert.equal(st('2026-11-08').text, 'Hết hạn 3 ngày trước');
  assert.deepEqual(st('2026-11-11'), { level: 'soon', days: 0, text: 'Hết hạn hôm nay' });
  assert.equal(st('2026-11-12').text, 'Hết hạn ngày mai');
  assert.equal(st('2026-11-14').level, 'soon', 'còn đúng 3 ngày vẫn là sắp hết hạn');
  assert.equal(st('2026-11-15').level, 'ok');
  assert.equal(st('').level, 'none');
  assert.equal(st('ngày mai').level, 'none');
  assert.equal(K.expiryStatus({ exp: '2027-01-02' }, '2026-12-30').text, 'Còn 3 ngày', 'qua năm mới vẫn đếm đúng');
});

test('sắp xếp tủ đồ: hết hạn, sắp hết hạn, còn lâu, không ghi hạn', () => {
  const stock = [
    { id: 1, name: 'Gạo', exp: '' }, { id: 2, name: 'Sữa', exp: '2026-11-10' }, { id: 3, name: 'Trứng', exp: '2026-11-25' },
    { id: 4, name: 'Rau muống', exp: '2026-11-12' }, { id: 5, name: 'Đậu hũ', exp: '2026-11-11' },
  ];
  assert.deepEqual(K.sortStock(stock, TODAY).map((x) => x.name), ['Sữa', 'Đậu hũ', 'Rau muống', 'Trứng', 'Gạo']);
  const s = K.stockSummary(stock, TODAY);
  assert.deepEqual([s.total, s.expired, s.soon], [5, 1, 2]);
  assert.deepEqual(s.names, ['Sữa', 'Rau muống', 'Đậu hũ']);
});

test('thêm đồ vào tủ: cùng tên cùng hạn thì cộng dồn, khác hạn thì tách dòng', () => {
  let r = K.addStock([], { name: 'thịt gà', qty: '500 g', exp: '2026-11-13' }, 'a', TODAY);
  assert.equal(r.stock[0].name, 'Thịt gà');
  assert.equal(r.stock[0].added, TODAY);
  r = K.addStock(r.stock, { name: 'Thịt Gà', qty: '0,5 kg', exp: '2026-11-13' }, 'b', TODAY);
  assert.equal(r.merged, true);
  assert.equal(r.stock.length, 1);
  assert.equal(r.stock[0].qty, '1 kg');
  r = K.addStock(r.stock, { name: 'Thịt gà', qty: '300 g', exp: '2026-11-20' }, 'c', TODAY);
  assert.equal(r.stock.length, 2);
  r = K.addStock(r.stock, { name: 'Thịt gà', qty: '2 hộp', exp: '2026-11-20' }, 'd', TODAY);
  assert.equal(r.stock.length, 3, 'khác đơn vị không cộng được thì thêm dòng mới');
  r = K.addStock(r.stock, { name: 'Muối', qty: '', exp: 'sai' }, 'e', TODAY);
  assert.equal(r.stock.find((x) => x.id === 'e').exp, '', 'hạn sai dạng thì bỏ');
  assert.equal(K.addStock([], { name: '   ' }, 'x').error, 'Nhập tên món đồ.');
});

test('trừ tủ đồ khỏi danh sách đi chợ', () => {
  const { items } = K.aggregate([{ d: byName('cà ri gà').id, s: 4 }], K.dishIndex(LIB, []));
  const stock = [
    { id: 1, name: 'Thịt gà', qty: '200 g', exp: '2026-11-13' },
    { id: 2, name: 'thit ga', qty: '0,1 kg', exp: '' },          // khác cách viết vẫn là một
    { id: 3, name: 'Khoai tây', qty: '5 củ', exp: '' },
    { id: 4, name: 'Cà rốt', qty: '2 củ', exp: '2026-11-01' },   // đã hết hạn: không tính
    { id: 5, name: 'Sả', qty: '', exp: '' },                    // có nhưng không ghi lượng
  ];
  const out = K.subtractStock(items, stock, TODAY);
  const get = (n) => out.find((x) => x.key === K.normName(n));
  assert.equal(get('thịt gà').need, '300 g');
  assert.equal(get('thịt gà').have, '300 g');
  assert.equal(get('thịt gà').partial, true);
  assert.equal(get('khoai tây').covered, true);
  assert.equal(get('khoai tây').need, '');
  assert.equal(get('cà rốt').covered, false, 'đồ hết hạn không được tính là có');
  assert.equal(get('cà rốt').need, '2 củ');
  assert.equal(get('sả').covered, true);
  assert.equal(get('sả').unsure, true);
  assert.equal(get('sả').partial, false);
  assert.equal(K.subtractStock(items, [{ id: 9, name: 'Thịt gà', qty: '101 g', exp: '' }], TODAY)[0].have === undefined, false);
  assert.equal(K.subtractStock(items, [{ id: 9, name: 'Thịt gà', qty: '101 g', exp: '' }], TODAY).find((x) => x.key === 'thit ga').have, '101 g', 'lượng đang có ghi đúng, không làm tròn');
  assert.equal(get('bột cà ri').have, '');
});

test('nấu xong thì trừ đồ trong tủ, dùng đồ gần hết hạn trước, hết thì bỏ khỏi tủ', () => {
  const dish = { id: 'x', name: 'Gà xào', servings: 2, items: [{ item: 'Thịt gà', qty: '400 g' }, { item: 'Hành lá', qty: 'một ít' }, { item: 'Ớt', qty: '1 quả' }] };
  const stock = [
    { id: 'a', name: 'Thịt gà', qty: '1 kg', exp: '2026-11-20' },
    { id: 'b', name: 'Thịt gà', qty: '300 g', exp: '2026-11-12' },  // gần hết hạn: dùng trước
    { id: 'c', name: 'Hành lá', qty: '1 bó', exp: '' },
    { id: 'd', name: 'Ớt', qty: '3 quả', exp: '2026-11-01' },        // đã hết hạn: không đụng tới
  ];
  const r = K.consume(stock, dish, 4, TODAY);                         // 4 người = gấp đôi: 800 g
  const get = (id) => r.stock.find((x) => x.id === id);
  assert.equal(get('b'), undefined, '300 g gần hết hạn dùng hết trước');
  assert.equal(get('a').qty, '500 g');
  assert.equal(get('c').qty, '1 bó', 'lượng chữ tự do không trừ');
  assert.equal(get('d').qty, '3 quả');
  assert.deepEqual(r.removed, ['Thịt gà']);
  assert.equal(stock[0].qty, '1 kg', 'không sửa mảng gốc');
});

/* ---------- gợi ý hôm nay nấu gì ---------- */
test('tủ trống thì không gợi ý bừa', () => {
  assert.deepEqual(K.suggest(LIB, [], {}, TODAY), []);
});

test('gợi ý món dùng được nhiều đồ có sẵn nhất, ưu tiên đồ sắp hết hạn', () => {
  const stock = [
    { id: 1, name: 'Thịt gà', qty: '700 g', exp: '2026-11-12' },
    { id: 2, name: 'Gừng', qty: '100 g', exp: '' },
    { id: 3, name: 'Hành tím', qty: '5 củ', exp: '' },
    { id: 4, name: 'Rau muống', qty: '500 g', exp: '2026-11-01' }, // đã hỏng: không được tính
  ];
  const s = K.suggest(LIB, stock, {}, TODAY, { limit: 3 });
  assert.equal(s[0].dish.name, 'Gà rang gừng');
  assert.equal(s[0].have, s[0].total, 'gia vị cơ bản (nước mắm, đường) không bị coi là thiếu');
  assert.deepEqual(s[0].useSoon, ['Thịt gà']);
  assert.match(s[0].reasons.join(' | '), /Dùng Thịt gà sắp hết hạn/);
  assert.ok(!s.some((x) => x.dish.name === 'Rau muống xào tỏi'), 'món chỉ dựa vào đồ hết hạn không được gợi ý');
  assert.ok(s.length <= 3);
});

test('món vừa ăn trong 3 ngày qua bị đẩy xuống, món đã có trong thực đơn hôm nay thì bỏ', () => {
  const stock = [{ id: 1, name: 'Thịt gà', qty: '1 kg', exp: '' }, { id: 2, name: 'Gừng', qty: '100 g', exp: '' }, { id: 3, name: 'Hành tím', qty: '3 củ', exp: '' }];
  const ga = byName('gà rang gừng');
  const before = K.suggest(LIB, stock, {}, TODAY)[0];
  assert.equal(before.dish.id, ga.id);
  const ate = K.addMeal({}, K.addDays(TODAY, -2), 'toi', ga, 4).meals;
  const after = K.suggest(LIB, stock, ate, TODAY);
  const g = after.find((x) => x.dish.id === ga.id);
  assert.ok(g && g.recent && g.score < before.score);
  const planned = K.addMeal({}, TODAY, 'trua', ga, 4).meals;
  assert.ok(!K.suggest(LIB, stock, planned, TODAY).some((x) => x.dish.id === ga.id));
  const old = K.addMeal({}, K.addDays(TODAY, -4), 'toi', ga, 4).meals;   // 4 ngày trước: không còn tính là "vừa ăn"
  assert.equal(K.suggest(LIB, stock, old, TODAY)[0].recent, false);
});

/* ---------- nhắc hạn dùng ---------- */
test('nhắc đồ sắp hết hạn lúc 18:00 hôm trước, chỉ trong 48 giờ tới', () => {
  const now = new Date(2026, 10, 11, 9, 0).getTime();                       // 9:00 ngày 11/11 giờ máy
  const stock = [
    { id: 'a', name: 'Sữa tươi', exp: '2026-11-12' },                        // nhắc 18:00 ngày 11
    { id: 'b', name: 'Thịt bò', exp: '2026-11-13' },                         // nhắc 18:00 ngày 12
    { id: 'c', name: 'Trứng', exp: '2026-11-20' },                           // còn xa
    { id: 'd', name: 'Cá', exp: '2026-11-11' },                              // mốc nhắc đã qua
    { id: 'e', name: 'Gạo', exp: '' },
  ];
  const r = K.expiryReminders(stock, now);
  assert.deepEqual(r.map((x) => x.key), ['k:a:2026-11-12', 'k:b:2026-11-13']);
  assert.equal(r[0].at, new Date(2026, 10, 11, 18, 0).getTime());
  assert.match(r[0].title, /Sữa tươi hết hạn ngày mai/);
  assert.ok(r.every((x) => x.title.length <= 160 && x.body.length <= 240), 'vừa giới hạn của máy chủ');
});

/* ---------- dữ liệu và đồng bộ ---------- */
test('làm sạch dữ liệu hỏng hoặc từ bản cũ', () => {
  assert.deepEqual(K.normalizeKitchen(null), { meals: {}, stock: [], recipes: [] });
  assert.deepEqual(K.normalizeKitchen([]), { meals: {}, stock: [], recipes: [] });
  const k = K.normalizeKitchen({
    meals: { '2026-11-11|toi': [{ d: 'lib:x', n: 'X', s: 99 }, { n: 'không có mã' }], 'sai-khoa': [{ d: 'a' }], '2026-11-12|sang': [] },
    stock: [{ id: 's1', name: 'Gạo', exp: 'mai' }, { name: 'không id' }, { id: 's2', name: '  ' }],
    recipes: [{ id: 'r1', name: 'Bánh', servings: 50, items: [{ item: 'Bột' }, { item: '' }] }, { id: 'r2' }],
  });
  assert.deepEqual(Object.keys(k.meals), ['2026-11-11|toi']);
  assert.deepEqual(k.meals['2026-11-11|toi'], [{ d: 'lib:x', n: 'X', s: 20 }]);
  assert.equal(k.stock.length, 1);
  assert.equal(k.stock[0].exp, '');
  assert.equal(k.recipes.length, 1);
  assert.equal(k.recipes[0].servings, 20);
  assert.deepEqual(k.recipes[0].items, [{ item: 'Bột', qty: '' }]);
});

test('gộp hai máy: tủ đồ theo từng món, bản sửa sau thắng, món đã xoá không sống lại', () => {
  const L = { stock: [{ id: 'a', name: 'Gạo', qty: '5 kg', u: 10 }, { id: 'b', name: 'Sữa', qty: '1 lít', u: 5 }], recipes: [] };
  const R = { stock: [{ id: 'a', name: 'Gạo', qty: '3 kg', u: 20 }, { id: 'b', name: 'Sữa', qty: '1 lít', u: 5 }, { id: 'c', name: 'Trứng', qty: '10 quả', u: 7 }], recipes: [{ id: 'r', name: 'Bánh', items: [{ item: 'Bột' }], u: 3 }] };
  const out = K.mergeKitchen(L, R, {}, {}, { b: 8 }).kitchen;
  assert.equal(out.stock.find((x) => x.id === 'a').qty, '3 kg');
  assert.equal(out.stock.find((x) => x.id === 'b'), undefined, 'bia mộ mới hơn bản sửa thì món bị xoá');
  assert.ok(out.stock.find((x) => x.id === 'c'));
  assert.equal(out.recipes.length, 1);
});

test('gộp hai máy: thực đơn theo từng bữa, bữa xoá mới hơn thì mất, bữa sửa mới hơn thì thắng', () => {
  const L = { meals: { '2026-11-11|toi': [{ d: 'lib:a', n: 'A', s: 4 }], '2026-11-12|trua': [{ d: 'lib:b', n: 'B', s: 4 }] } };
  const R = { meals: { '2026-11-11|toi': [{ d: 'lib:c', n: 'C', s: 2 }], '2026-11-13|sang': [{ d: 'lib:d', n: 'D', s: 1 }] } };
  // máy phải sửa bữa tối 11 sau; máy phải xoá bữa trưa 12 sau khi máy trái thêm
  const r = K.mergeKitchen(L, R, { '2026-11-11|toi': 10, '2026-11-12|trua': 10 }, { '2026-11-11|toi': 20, '2026-11-12|trua': 30, '2026-11-13|sang': 5 }, {});
  assert.equal(r.kitchen.meals['2026-11-11|toi'][0].n, 'C');
  assert.equal(r.kitchen.meals['2026-11-12|trua'], undefined);
  assert.equal(r.kitchen.meals['2026-11-13|sang'][0].n, 'D');
  assert.equal(r.mealU['2026-11-12|trua'], 30, 'giữ dấu thời gian của lần xoá để lần gộp sau không hồi sinh');
  // gộp lặp lại không đổi kết quả (lũy đẳng) và đổi vế cũng ra như nhau (giao hoán)
  const again = K.mergeKitchen(r.kitchen, r.kitchen, r.mealU, r.mealU, {});
  assert.deepEqual(again.kitchen.meals, r.kitchen.meals);
  const swapped = K.mergeKitchen(R, L, { '2026-11-11|toi': 20, '2026-11-12|trua': 30, '2026-11-13|sang': 5 }, { '2026-11-11|toi': 10, '2026-11-12|trua': 10 }, {});
  assert.deepEqual(swapped.kitchen.meals, r.kitchen.meals);
});

test('bản dữ liệu cũ chưa có phần bếp gộp với bản mới không mất gì', () => {
  const R = { stock: [{ id: 'a', name: 'Gạo', qty: '5 kg', u: 1 }], meals: { '2026-11-11|toi': [{ d: 'lib:a', n: 'A', s: 4 }] }, recipes: [] };
  const r = K.mergeKitchen(undefined, R, undefined, { '2026-11-11|toi': 1 }, undefined);
  assert.equal(r.kitchen.stock.length, 1);
  assert.equal(r.kitchen.meals['2026-11-11|toi'][0].n, 'A');
});

/* ---------- các trường hợp biên (thêm sau khi chạy kiểm thử đột biến: scripts/mutation-test.js) ---------- */
test('biên: số người 1 và 20 hợp lệ, 21 thì không; tên đúng 60 ký tự vẫn được', () => {
  const ok = (s, name) => K.validateRecipe({ name: name || 'Bánh', items: [{ item: 'Bột' }], servings: s });
  assert.equal(ok(1), '');
  assert.equal(ok(20), '');
  assert.notEqual(ok(21), '');
  assert.equal(ok(2, 'x'.repeat(60)), '');
});

test('biên: 1000 ml là 1 lít, 1000 g là 1 kg', () => {
  assert.equal(K.fmtAmount(1000, 'ml', 'ml'), '1 lít');
  assert.equal(K.fmtAmount(1000, 'g', 'g'), '1 kg');
  assert.equal(K.fmtAmount(999, 'ml', 'ml'), '999 ml');
});

test('thứ tự hiển thị lượng: gram, rồi ml, rồi đơn vị đếm, bất kể thứ tự cộng', () => {
  const a = K.newAmount();
  K.addAmount(a, '2 củ'); K.addAmount(a, '100 ml'); K.addAmount(a, '50 g'); K.addAmount(a, '1 bó');
  assert.equal(K.amountText(a), '50 g + 100 ml + 1 bó + 2 củ');
});

test('ngày theo giờ máy ra đúng chuỗi YYYY-MM-DD', () => {
  assert.equal(K.localKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(K.localKey(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('tìm món khớp ở đầu tên (không chỉ ở giữa)', () => {
  assert.deepEqual(K.searchDishes(K.allDishes(LIB, []), 'bun cha').map((d) => d.name), ['Bún chả']);
  assert.deepEqual(K.searchDishes(K.allDishes(LIB, []), 'xyz'), []);
});

test('món tự tạo thiếu số người thì mặc định 4; thêm món không ghi số người thì theo công thức', () => {
  assert.equal(K.recipeToDish({ id: 'r', name: 'a', items: [] }).servings, 4);
  assert.equal(K.normalizeKitchen({ recipes: [{ id: 'r', name: 'a', items: [] }] }).recipes[0].servings, 4);
  const r = K.addMeal({}, TODAY, 'sang', { id: 'r', name: 'Xôi', servings: 3 }, undefined);
  assert.equal(r.added, true);
  assert.equal(r.meals['2026-11-11|sang'][0].s, 3);
  assert.deepEqual(K.removeMeal({}, TODAY, 'sang', 0), {}, 'bỏ món ở bữa trống không lỗi');
});

test('một món xuất hiện nhiều bữa trong tuần chỉ ghi tên một lần; món mất công thức chỉ báo một lần', () => {
  const c = byName('cà ri gà');
  const { items, missing } = K.aggregate([{ d: c.id, s: 4 }, { d: c.id, s: 4 }, { d: 'x', n: 'Bánh xèo' }, { d: 'x', n: 'Bánh xèo' }], K.dishIndex(LIB, []));
  const ga = items.find((x) => x.key === 'thit ga');
  assert.deepEqual(ga.dishes, ['Cà ri gà']);
  assert.equal(ga.text, '1,2 kg');
  assert.deepEqual(missing, ['Bánh xèo']);
});

test('tủ đầy 300 món thì không thêm được nữa', () => {
  let stock = [];
  for (let i = 0; i < 299; i++) stock.push({ id: 'i' + i, name: 'Món ' + i, qty: '', exp: '' });
  let r = K.addStock(stock, { name: 'Món mới' }, 'n1', TODAY);
  assert.equal(r.error, undefined);
  assert.equal(r.merged, false);
  assert.equal(r.stock.length, 300);
  r = K.addStock(r.stock, { name: 'Món nữa' }, 'n2', TODAY);
  assert.match(r.error, /đầy/);
});

test('thêm đồ trùng tên: dòng cũ chưa ghi lượng thì nhận lượng mới, thêm không ghi lượng thì giữ dòng cũ', () => {
  let r = K.addStock([{ id: 'a', name: 'Hành lá', qty: '', exp: '' }], { name: 'hành lá', qty: '1 bó' }, 'b', TODAY);
  assert.deepEqual([r.merged, r.stock.length, r.stock[0].qty], [true, 1, '1 bó']);
  r = K.addStock(r.stock, { name: 'Hành lá', qty: '' }, 'c', TODAY);
  assert.deepEqual([r.merged, r.stock.length, r.stock[0].qty, r.id], [true, 1, '1 bó', 'a']);
});

test('so với tủ: có cả dòng ghi lượng lẫn dòng không ghi lượng thì tính theo lượng; lượng chữ thì ghi "Có trong tủ"', () => {
  const items = K.aggregate([{ d: byName('cà ri gà').id, s: 4 }], K.dishIndex(LIB, [])).items;
  const out = K.subtractStock(items, [
    { id: 1, name: 'Thịt gà', qty: '', exp: '' }, { id: 2, name: 'Thịt gà', qty: '100 g', exp: '' },
    { id: 3, name: 'Sả', qty: 'vài cây', exp: '' },
  ], TODAY);
  const ga = out.find((x) => x.key === 'thit ga');
  assert.deepEqual([ga.covered, ga.partial, ga.need, !!ga.unsure], [false, true, '500 g', false]);
  const sa = out.find((x) => x.key === 'sa');
  assert.equal(sa.have, 'vài cây');
  const none = out.find((x) => x.key === 'bot ca ri');
  assert.deepEqual([none.covered, none.partial, none.need], [false, false, '1 gói']);
  const k2 = K.subtractStock(items, [{ id: 1, name: 'Sả', qty: '5 cây', exp: '' }], TODAY).find((x) => x.key === 'sa');
  assert.deepEqual([k2.covered, k2.partial, k2.need, k2.have], [true, false, '', '5 cây']);
});

test('nấu xong: tên đồ đã dùng không lặp; đồ vừa đủ thì hết khỏi tủ', () => {
  const dish = { id: 'x', name: 'Gà', servings: 1, items: [{ item: 'Thịt gà', qty: '500 g' }] };
  const r = K.consume([{ id: 'a', name: 'Thịt gà', qty: '200 g', exp: '' }, { id: 'b', name: 'Thịt gà', qty: '300 g', exp: '' }], dish, 1, TODAY);
  assert.deepEqual(r.used, ['Thịt gà']);
  assert.deepEqual(r.stock, []);
  const r2 = K.consume([{ id: 'a', name: 'Thịt gà', qty: '2 hộp', exp: '' }], dish, 1, TODAY);
  assert.equal(r2.stock[0].qty, '2 hộp', 'khác đơn vị thì không trừ');
});

test('gợi ý: món chỉ có gia vị cơ bản (kể cả muối) không chiếm điểm; ăn đúng 3 ngày trước vẫn tính là vừa ăn', () => {
  const salt = { id: 's', name: 'Trứng luộc', servings: 1, mine: true, aliases: [], items: [{ item: 'Muối', qty: '1 muỗng' }, { item: 'Trứng gà', qty: '2 quả' }] };
  const s = K.suggest([salt], [{ id: 1, name: 'Trứng gà', qty: '10 quả', exp: '' }], {}, TODAY);
  assert.equal(s[0].total, 1, 'muối là gia vị cơ bản, không tính');
  assert.equal(s[0].have, 1);
  const ate = K.addMeal({}, K.addDays(TODAY, -3), 'sang', salt, 1).meals;
  assert.equal(K.suggest([salt], [{ id: 1, name: 'Trứng gà', qty: '10 quả', exp: '' }], ate, TODAY)[0].recent, true);
});

test('nhắc hạn dùng: đúng 48 giờ là ranh giới', () => {
  const now = new Date(2026, 10, 11, 17, 30).getTime();
  const r = K.expiryReminders([{ id: 'a', name: 'Sữa', exp: '2026-11-14' }], now);   // 18:00 ngày 13 = 48,5 giờ nữa
  assert.deepEqual(r, []);
  assert.equal(K.expiryReminders([{ id: 'a', name: 'Sữa', exp: '2026-11-14' }], now, 49 * 3600000).length, 1);
});

test('gộp: bia mộ đúng bằng mốc sửa thì vẫn xoá; dữ liệu rác trong bữa bị bỏ', () => {
  const out = K.mergeKitchen({ stock: [{ id: 'a', name: 'Gạo', u: 5 }] }, {}, {}, {}, { a: 5 }).kitchen;
  assert.deepEqual(out.stock, []);
  const k = K.normalizeKitchen({ meals: { '2026-11-11|toi': [null, { d: '' }, { d: 'lib:a', s: 'x' }] } });
  assert.deepEqual(k.meals['2026-11-11|toi'], [{ d: 'lib:a', n: '', s: 4 }]);
  const m = K.mergeKitchen({ meals: { '2026-11-11|toi': [{ d: 'a', s: 1 }] } }, {}, {}, {}, {});
  assert.deepEqual(m.mealU, {}, 'không bịa dấu thời gian khi cả hai bên chưa có');
});

test('gợi ý: món chỉ có sẵn chưa tới 30% nguyên liệu thì không gợi ý, trừ khi dùng được đồ sắp hết hạn', () => {
  const bun = byName('bún chả');                         // 5 nguyên liệu chính (nước mắm là gia vị)
  const one = [{ id: 1, name: 'Bún', qty: '1 kg', exp: '' }];
  assert.ok(!K.suggest([bun], one, {}, TODAY).length, '1/5 = 20%: chưa gợi ý');
  const two = one.concat([{ id: 2, name: 'Hành tím', qty: '3 củ', exp: '' }]);
  assert.equal(K.suggest([bun], two, {}, TODAY).length, 1, '2/5 = 40%: gợi ý');
  const soon = [{ id: 1, name: 'Bún', qty: '1 kg', exp: '2026-11-12' }];
  assert.equal(K.suggest([bun], soon, {}, TODAY).length, 1, 'bún sắp hết hạn thì vẫn gợi ý để dùng kịp');
});

/* ---------- kiểm thử ngẫu nhiên theo tính chất (property-based), có hạt giống cố định nên lần nào chạy cũng như nhau ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

test('tính chất: tổng gram sau khi gộp đúng bằng tổng từng món (không mất, không nhân đôi), ở 200 thực đơn ngẫu nhiên', () => {
  const r = rng(42), idx = K.dishIndex(LIB, []);
  for (let round = 0; round < 200; round++) {
    const entries = [];
    const n = 1 + Math.floor(r() * 12);
    for (let i = 0; i < n; i++) { const d = LIB[Math.floor(r() * LIB.length)]; entries.push({ d: d.id, s: 1 + Math.floor(r() * 8) }); }
    let expect = 0;
    entries.forEach((e) => { const d = idx[e.d]; d.items.forEach((x) => { const b = K.toBase(x.qty); if (b && b.dim === 'g') expect += b.n * e.s / d.servings; }); });
    const got = K.aggregate(entries, idx).items.reduce((a, it) => a + (it.amount.parts.g || 0), 0);
    assert.ok(Math.abs(got - expect) < 1e-6, `vòng ${round}: ${got} khác ${expect}`);
  }
});

test('tính chất: gộp dữ liệu hai máy giao hoán, lũy đẳng và không làm mất món nào còn sống, ở 200 cặp ngẫu nhiên', () => {
  const r = rng(7);   // lỗi thật tìm được nhờ test này: hai máy cùng mốc thời gian từng ra hai thực đơn khác nhau
  const ids = ['a', 'b', 'c', 'd', 'e'], keys = ['2026-11-09|sang', '2026-11-09|toi', '2026-11-10|trua'];
  const side = () => {
    const stock = ids.filter(() => r() < 0.6).map((id) => ({ id, name: 'Đồ ' + id, qty: Math.ceil(r() * 9) + ' củ', u: Math.ceil(r() * 50) }));
    const meals = {}, mealU = {};
    keys.forEach((k) => { if (r() < 0.5) { meals[k] = [{ d: 'lib:' + Math.ceil(r() * 3), n: 'M', s: 2 }]; } if (r() < 0.7) mealU[k] = Math.ceil(r() * 50); });
    return { k: { stock, meals, recipes: [] }, u: mealU };
  };
  const canon = (x) => JSON.stringify({ s: x.kitchen.stock.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), m: Object.keys(x.kitchen.meals).sort().map((k) => [k, x.kitchen.meals[k]]), u: Object.keys(x.mealU).sort().map((k) => [k, x.mealU[k]]) });
  for (let round = 0; round < 200; round++) {
    const L = side(), R = side();
    const del = {};
    ids.forEach((id) => { if (r() < 0.2) del[id] = Math.ceil(r() * 50); });
    const ab = K.mergeKitchen(L.k, R.k, L.u, R.u, del), ba = K.mergeKitchen(R.k, L.k, R.u, L.u, del);
    assert.equal(canon(ab), canon(ba), 'vòng ' + round + ': không giao hoán');
    const again = K.mergeKitchen(ab.kitchen, ab.kitchen, ab.mealU, ab.mealU, del);
    assert.equal(canon(again), canon(ab), 'vòng ' + round + ': gộp lại lần nữa làm đổi kết quả');
    // mọi món trong tủ của một trong hai bên, nếu không bị bia mộ mới hơn, phải còn sau khi gộp
    L.k.stock.concat(R.k.stock).forEach((x) => {
      if (!(del[x.id] >= x.u)) assert.ok(ab.kitchen.stock.some((y) => y.id === x.id), 'vòng ' + round + ': mất ' + x.id);
    });
  }
});

/* ---------- với máy chủ thật: phần bếp đi qua API đồng bộ nguyên vẹn ---------- */
const { start } = require('./helpers');

test('máy chủ lưu và trả lại phần bếp nguyên vẹn; xung đột trả bản mới để máy khách tự gộp', async () => {
  const s = await start();
  try {
    const { c } = await s.user('bep@example.com', 'Bếp');
    let k = K.addStock([], { name: 'Thịt gà', qty: '500 g', exp: '2026-11-12' }, 'st-1', TODAY);
    const kitchen = { meals: K.addMeal({}, TODAY, 'toi', byName('cà ri gà'), 4).meals, stock: k.stock, recipes: [{ id: 'my-1', name: 'Bánh', servings: 2, items: [{ item: 'Bột', qty: '200 g' }] }] };
    const put = await c.req('PUT', '/api/state', { baseVersion: 0, state: { kitchen, meta: { mealU: { '2026-11-11|toi': 5 } } } });
    assert.equal(put.status, 200);
    const got = (await c.req('GET', '/api/state')).json.state;
    assert.deepEqual(K.normalizeKitchen(got.kitchen), K.normalizeKitchen(kitchen));
    // máy thứ hai còn ở phiên bản 0 sửa thực đơn: bị từ chối, nhận bản mới, gộp rồi đẩy lại
    const mine = { meals: K.addMeal({}, TODAY, 'sang', byName('phở bò'), 2).meals, stock: [], recipes: [] };
    const stale = await c.req('PUT', '/api/state', { baseVersion: 0, state: { kitchen: mine, meta: { mealU: { '2026-11-11|sang': 9 } } } });
    assert.equal(stale.status, 409);
    const merged = K.mergeKitchen(mine, stale.json.state.kitchen, { '2026-11-11|sang': 9 }, stale.json.state.meta.mealU, {});
    const again = await c.req('PUT', '/api/state', { baseVersion: stale.json.version, state: { kitchen: merged.kitchen, meta: { mealU: merged.mealU } } });
    assert.equal(again.status, 200);
    const fin = (await c.req('GET', '/api/state')).json.state.kitchen;
    assert.deepEqual(Object.keys(fin.meals).sort(), ['2026-11-11|sang', '2026-11-11|toi']);
    assert.equal(fin.stock[0].name, 'Thịt gà');
  } finally { await s.close(); }
});

test('máy chủ nhận lời nhắc hạn dùng (đúng định dạng và giới hạn độ dài)', async () => {
  const s = await start();
  try {
    const { c } = await s.user('bep2@example.com', 'Bếp');
    const now = Date.now();
    const exp = K.localKey(new Date(now + 36 * 3600000));          // khoảng một ngày rưỡi nữa: lời nhắc 18:00 hôm trước nằm trong 48 giờ
    const sched = K.expiryReminders([{ id: 'st-1', name: 'Đ'.repeat(60), exp }], now);
    assert.equal(sched.length, 1);
    const r = await c.req('PUT', '/api/state', { baseVersion: 0, state: {}, schedule: sched });
    assert.equal(r.status, 200);
    const row = s.app.db.prepare("SELECT key, title FROM reminders WHERE key LIKE 'k:%'").get();
    assert.equal(row.key, 'k:st-1:' + exp);
    assert.match(row.title, /hết hạn ngày mai/);
  } finally { await s.close(); }
});
