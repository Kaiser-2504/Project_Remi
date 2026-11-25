-- test-tach-bang.sql — kiểm tra migration 004: tài liệu JSON được tách đúng ra các bảng.
-- Chạy sau migration trên Postgres SẠCH: psql ... -v ON_ERROR_STOP=1 -f db/test-tach-bang.sql
\set ON_ERROR_STOP on
begin;

truncate remi.users cascade;
insert into remi.users (id, email, pw_hash) values
  ('11111111-1111-1111-1111-111111111111', 'a@x.vn', 'h1'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.vn', 'h2');

-- Một tài liệu giống app gửi lên, có lẫn vài giá trị hỏng
insert into remi.states (user_id, version, data) values ('11111111-1111-1111-1111-111111111111', 1, $json$
{
  "tasks": [
    {"id": "t1", "title": "Đi chợ", "emoji": "🛒", "when": "2026-11-26T17:00", "durMin": 30, "leadMin": 15, "repeat": "none", "shop": true, "done": false,
     "checklist": [{"item": "Thịt gà", "qty": "500 g", "done": true}, {"item": "Rau muống", "qty": "1 bó"}, {"item": ""}]},
    {"id": "t2", "title": "Học bài", "when": "2026-11-24T20:00", "repeat": "daily", "done": true, "note": "Ôn chương 3"},
    {"id": "t3", "title": "Giờ hỏng", "when": "2026-02-30T25:99", "repeat": "monthly", "durMin": "abc", "done": "có"},
    {"id": "t1", "title": "Trùng id, bị bỏ"},
    {"title": "Không có id"},
    "không phải object"
  ],
  "habits": [
    {"id": "h1", "title": "Uống nước", "emoji": "💧", "portionMl": 250, "days": [0,1,2,3,4,5,6], "times": ["08:00","10:00","14:00","16:00"],
     "log": {"2026-11-24": 4, "2026-11-25": 3, "2026-11-26": 0, "ngày-sai": 2}},
    {"id": "h2", "title": "Đọc sách", "days": [1, 3, 9], "times": ["21:00"], "log": {"2026-11-25": 1}}
  ],
  "dayNotes": {"2026-11-26": "Sinh nhật mẹ", "2026-11-27": "", "sai": "x"},
  "kitchen": {
    "stock": [{"id": "s1", "name": "Trứng", "qty": "10 quả", "exp": "2026-11-28"}, {"id": "s2", "name": "Gạo", "exp": ""}],
    "recipes": [{"id": "r1", "name": "Canh chua", "servings": 4, "items": [{"item": "Cá lóc", "qty": "500 g"}, {"item": "Me"}]}],
    "meals": {"2026-11-30|sang": [{"d": "pho", "n": "Phở bò", "s": 2}], "2026-11-30|toi": [{"d": "r1", "n": "Canh chua"}, {"d": "rau", "n": "Rau luộc"}], "sai|trua": [{"d": "x"}]}
  }
}
$json$);

do $$
declare n int; t record; h record;
begin
  -- việc
  select count(*) into n from remi.tasks where user_id = '11111111-1111-1111-1111-111111111111';
  if n <> 3 then raise exception 'FAIL: cần 3 việc (bỏ trùng id, thiếu id, không phải object), có %', n; end if;
  select * into t from remi.tasks where client_id = 't1';
  if t.due_at <> '2026-11-26 17:00'::timestamp or not t.is_shopping or t.lead_min <> 15 then raise exception 'FAIL: việc t1 sai: %', row_to_json(t); end if;
  select count(*) into n from remi.task_items where task_id = t.id;
  if n <> 2 then raise exception 'FAIL: t1 cần 2 món cần mua (bỏ món rỗng), có %', n; end if;
  if not (select done from remi.task_items where task_id = t.id and position = 1) then raise exception 'FAIL: món 1 phải done'; end if;
  select * into t from remi.tasks where client_id = 't2';
  if t.repeat <> 'daily' or not t.done or t.note <> 'Ôn chương 3' then raise exception 'FAIL: việc t2 sai'; end if;
  select * into t from remi.tasks where client_id = 't3';
  if t.due_at is not null or t.repeat <> 'none' or t.duration_min is not null or t.done then raise exception 'FAIL: giá trị hỏng của t3 phải thành null/mặc định: %', row_to_json(t); end if;

  -- thói quen
  select * into h from remi.habits where client_id = 'h1';
  if h.portion_ml <> 250 or array_length(h.times, 1) <> 4 then raise exception 'FAIL: thói quen h1 sai'; end if;
  select count(*) into n from remi.habit_logs where habit_id = h.id;
  if n <> 2 then raise exception 'FAIL: h1 cần 2 ngày có ghi (bỏ ngày 0 lần và ngày sai), có %', n; end if;
  if (select count from remi.habit_logs where habit_id = h.id and day = '2026-11-24') <> 4 then raise exception 'FAIL: số lần ngày 24 sai'; end if;
  select * into h from remi.habits where client_id = 'h2';
  if h.days <> '{1,3}'::smallint[] or h.portion_ml is not null then raise exception 'FAIL: h2 phải bỏ thứ 9: %', h.days; end if;

  -- ghi chú, bếp
  select count(*) into n from remi.day_notes;
  if n <> 1 then raise exception 'FAIL: cần 1 ghi chú (bỏ rỗng và ngày sai), có %', n; end if;
  if (select expires_on from remi.pantry_items where client_id = 's1') <> '2026-11-28' then raise exception 'FAIL: hạn dùng trứng sai'; end if;
  if (select expires_on from remi.pantry_items where client_id = 's2') is not null then raise exception 'FAIL: gạo không có hạn'; end if;
  select count(*) into n from remi.recipe_items ri join remi.recipes r on r.id = ri.recipe_id where r.client_id = 'r1';
  if n <> 2 then raise exception 'FAIL: canh chua cần 2 nguyên liệu, có %', n; end if;
  select count(*) into n from remi.meal_plans;
  if n <> 3 then raise exception 'FAIL: cần 3 món trong thực đơn (bỏ ngày sai), có %', n; end if;
  if (select servings from remi.meal_plans where slot = 'toi' and position = 1) <> 4 then raise exception 'FAIL: khẩu phần mặc định phải là 4'; end if;
end $$;

-- Cập nhật tài liệu: bảng được làm mới theo bản mới (việc bị xoá trong app thì mất khỏi bảng)
update remi.states set data = '{"tasks":[{"id":"t9","title":"Việc mới","when":"2026-12-01T08:00"}],"habits":[]}', version = 2
where user_id = '11111111-1111-1111-1111-111111111111';
do $$
declare n int;
begin
  select count(*) into n from remi.tasks;
  if n <> 1 then raise exception 'FAIL: sau cập nhật chỉ còn 1 việc, có %', n; end if;
  select count(*) into n from remi.task_items;
  if n <> 0 then raise exception 'FAIL: món của việc cũ phải bị xoá theo (cascade), còn %', n; end if;
  select count(*) into n from remi.habit_logs;
  if n <> 0 then raise exception 'FAIL: nhật ký thói quen cũ phải bị xoá, còn %', n; end if;
end $$;

-- Dữ liệu của người khác không bị đụng tới
insert into remi.states (user_id, version, data) values ('22222222-2222-2222-2222-222222222222', 1, '{"tasks":[{"id":"t1","title":"Của B"}]}');
do $$ begin
  if (select count(*) from remi.tasks) <> 2 then raise exception 'FAIL: mỗi người có việc riêng'; end if;
  if (select count(*) from remi.tasks where client_id = 't1') <> 1 then raise exception 'FAIL: cùng client_id ở hai người là hai dòng khác nhau'; end if;
end $$;

-- Tài liệu không phải object vẫn lưu được, bảng trống
update remi.states set data = '[]'::jsonb, version = 3 where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select count(*) from remi.tasks where user_id = '11111111-1111-1111-1111-111111111111') <> 0 then raise exception 'FAIL: tài liệu rỗng thì không còn việc'; end if;
end $$;

-- Xoá tài khoản: mọi bảng con đi theo
delete from remi.users where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from remi.tasks) <> 0 then raise exception 'FAIL: xoá tài khoản phải xoá việc'; end if;
end $$;

-- anon không đọc được bảng mới
do $$ begin
  if has_table_privilege('anon', 'remi.tasks', 'select') or has_table_privilege('authenticated', 'remi.habit_logs', 'select') then
    raise exception 'FAIL: anon/authenticated không được đọc bảng dữ liệu';
  end if;
end $$;

select 'OK: tách bảng đúng' as ket_qua;
rollback;
