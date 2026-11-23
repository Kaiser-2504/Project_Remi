-- smoke.sql — kiểm thử nhanh lớp dữ liệu bằng SQL thuần (không cần driver).
-- Chạy sau migration, trên Postgres SẠCH: psql ... -v ON_ERROR_STOP=1 -f db/smoke.sql
-- Thoát với lỗi nếu bất kỳ khẳng định nào sai. Dùng được trong CI.
\set ON_ERROR_STOP on
begin;

-- dọn sạch để chạy lặp được
truncate remi.users cascade;
truncate remi.rate_limits;

insert into remi.users (id, email, pw_hash) values
  ('11111111-1111-1111-1111-111111111111', 'a@x.vn', 'h1'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.vn', 'h2');

-- CHECK: email không phân biệt hoa thường
do $$ begin
  begin
    insert into remi.users (email, pw_hash) values ('A@X.VN', 'h');
    raise exception 'FAIL: email trùng khác hoa thường lẽ ra bị chặn';
  exception when unique_violation then null; end;
end $$;

-- CHECK: khoá lạc quan
insert into remi.states (user_id, version, data) values ('11111111-1111-1111-1111-111111111111', 1, '{}');
do $$
declare v int;
begin
  update remi.states set version = version + 1 where user_id='11111111-1111-1111-1111-111111111111' and version=1 returning version into v;
  if v <> 2 then raise exception 'FAIL: ghi đúng base phải lên version 2, nhận %', v; end if;
  update remi.states set version = version + 1 where user_id='11111111-1111-1111-1111-111111111111' and version=1 returning version into v;
  if found then raise exception 'FAIL: ghi base cũ lẽ ra 0 dòng'; end if;
end $$;

-- CHECK: upsert lời nhắc đổi giờ reset sent_at, giữ giờ thì không
insert into remi.reminders (user_id, key, at, title, sent_at)
  values ('11111111-1111-1111-1111-111111111111','k', '2026-11-18 01:00+00','t', now());
insert into remi.reminders (user_id, key, at, title) values ('11111111-1111-1111-1111-111111111111','k','2026-11-18 01:00+00','t2')
  on conflict (user_id,key) do update set at=excluded.at, title=excluded.title,
    sent_at = case when remi.reminders.at is distinct from excluded.at then null else remi.reminders.sent_at end;
do $$ begin
  if (select sent_at from remi.reminders where key='k') is null then raise exception 'FAIL: giữ giờ mà sent_at bị xoá'; end if;
end $$;
insert into remi.reminders (user_id, key, at, title) values ('11111111-1111-1111-1111-111111111111','k','2026-11-18 02:00+00','t3')
  on conflict (user_id,key) do update set at=excluded.at, title=excluded.title,
    sent_at = case when remi.reminders.at is distinct from excluded.at then null else remi.reminders.sent_at end;
do $$ begin
  if (select sent_at from remi.reminders where key='k') is not null then raise exception 'FAIL: đổi giờ mà sent_at không reset'; end if;
end $$;

-- CHECK: câu nhận lời nhắc chỉ lấy dòng đến hạn trong cửa sổ
delete from remi.reminders;
insert into remi.reminders (user_id, key, at, title) values
  ('11111111-1111-1111-1111-111111111111','due',   now()-interval '1 min','a'),
  ('11111111-1111-1111-1111-111111111111','future',now()+interval '10 min','b'),
  ('11111111-1111-1111-1111-111111111111','stale', now()-interval '40 min','c');
do $$
declare got text;
begin
  with due as (
    select id from remi.reminders where sent_at is null and at <= now() and at > now() - interval '30 minutes'
    order by at limit 50 for update skip locked
  )
  update remi.reminders r set sent_at=now() from due where r.id=due.id returning r.key into got;
  if got <> 'due' then raise exception 'FAIL: phải nhận đúng "due", nhận %', got; end if;
end $$;

-- CHECK: bộ đếm AI chặn khi đạt giới hạn
do $$
declare r int;
begin
  for i in 1..3 loop
    with up as (insert into remi.ai_usage (user_id, day, count) values ('22222222-2222-2222-2222-222222222222', current_date, 1)
      on conflict (user_id, day) do update set count = remi.ai_usage.count + 1 where remi.ai_usage.count < 3 returning count)
    select count into r from up;
  end loop;
  with up as (insert into remi.ai_usage (user_id, day, count) values ('22222222-2222-2222-2222-222222222222', current_date, 1)
    on conflict (user_id, day) do update set count = remi.ai_usage.count + 1 where remi.ai_usage.count < 3 returning count)
  select count into r from up;
  if found then raise exception 'FAIL: lượt thứ 4 lẽ ra bị chặn'; end if;
end $$;

rollback;  -- không để lại dữ liệu
\echo 'SMOKE OK: tất cả khẳng định đúng.'
