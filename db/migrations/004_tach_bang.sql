-- Remi — migration 004: tách dữ liệu ứng dụng thành các bảng riêng có quan hệ.
--
-- Ứng dụng vẫn đồng bộ bằng một tài liệu JSON trong remi.states.data (gộp ngoại tuyến, khoá lạc quan),
-- nhưng mỗi lần tài liệu được ghi, trigger dưới đây tách nó ra các bảng:
--   tasks ─< task_items          việc và danh sách cần chuẩn bị / đi chợ
--   habits ─< habit_logs         thói quen và số lần làm mỗi ngày
--   day_notes                    ghi chú theo ngày
--   pantry_items                 tủ đồ nhà, có hạn dùng
--   recipes ─< recipe_items      món của tôi và nguyên liệu
--   meal_plans                   thực đơn tuần (ngày × bữa)
-- Mọi bảng thuộc về remi.users (on delete cascade). Ghi JSON và tách bảng nằm trong CÙNG một giao dịch.
-- An toàn khi chạy lại nhiều lần.

-- ---------------------------------------------------------------- bảng
create table if not exists remi.tasks (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references remi.users(id) on delete cascade,
  client_id     text not null,                       -- id do app tạo (uid()), ổn định giữa các thiết bị
  title         text not null,
  emoji         text not null default '',
  due_at        timestamp,                            -- giờ địa phương của người dùng, như app lưu
  duration_min  integer check (duration_min is null or duration_min between 0 and 1440),
  lead_min      integer check (lead_min is null or lead_min between 0 and 10080),
  repeat        text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  done          boolean not null default false,
  is_shopping   boolean not null default false,
  note          text not null default '',
  unique (user_id, client_id)
);
create index if not exists tasks_user_due_idx on remi.tasks (user_id, due_at);

create table if not exists remi.task_items (
  task_id   bigint not null references remi.tasks(id) on delete cascade,
  position  integer not null,
  item      text not null,
  qty       text not null default '',
  done      boolean not null default false,
  primary key (task_id, position)
);

create table if not exists remi.habits (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references remi.users(id) on delete cascade,
  client_id   text not null,
  title       text not null,
  emoji       text not null default '',
  days        smallint[] not null default '{0,1,2,3,4,5,6}',  -- thứ trong tuần (0 = Chủ nhật)
  times       text[] not null default '{}',                    -- giờ nhắc 'HH:MM'
  portion_ml  integer check (portion_ml is null or portion_ml > 0), -- có giá trị = thói quen uống nước
  once        boolean not null default false,
  unique (user_id, client_id)
);

create table if not exists remi.habit_logs (
  habit_id  bigint not null references remi.habits(id) on delete cascade,
  day       date not null,
  count     integer not null check (count > 0),
  primary key (habit_id, day)
);

create table if not exists remi.day_notes (
  user_id  uuid not null references remi.users(id) on delete cascade,
  day      date not null,
  note     text not null,
  primary key (user_id, day)
);

create table if not exists remi.pantry_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references remi.users(id) on delete cascade,
  client_id   text not null,
  name        text not null,
  qty         text not null default '',
  expires_on  date,
  unique (user_id, client_id)
);
create index if not exists pantry_items_exp_idx on remi.pantry_items (user_id, expires_on);

create table if not exists remi.recipes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references remi.users(id) on delete cascade,
  client_id  text not null,
  name       text not null,
  servings   integer not null default 4 check (servings between 1 and 20),
  note       text not null default '',
  unique (user_id, client_id)
);

create table if not exists remi.recipe_items (
  recipe_id  bigint not null references remi.recipes(id) on delete cascade,
  position   integer not null,
  item       text not null,
  qty        text not null default '',
  primary key (recipe_id, position)
);

create table if not exists remi.meal_plans (
  user_id    uuid not null references remi.users(id) on delete cascade,
  day        date not null,
  slot       text not null check (slot in ('sang', 'trua', 'toi')),
  position   integer not null,
  dish_id    text not null,
  dish_name  text not null default '',
  servings   integer not null default 4 check (servings between 1 and 20),
  primary key (user_id, day, slot, position)
);

-- ---------------------------------------------------------------- hàm chuyển kiểu an toàn
-- Dữ liệu đến từ trình duyệt: giá trị hỏng thì thành null thay vì làm lỗi cả lần lưu.
create or replace function remi.try_date(v text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return v::date;
exception when others then return null;
end $$;

create or replace function remi.try_ts(v text) returns timestamp
language plpgsql immutable set search_path = '' as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then return null; end if;
  return left(v, 16)::timestamp;
exception when others then return null;
end $$;

create or replace function remi.try_int(v text) returns integer
language plpgsql immutable set search_path = '' as $$
begin
  if v is null or v !~ '^-?\d{1,9}(\.\d+)?$' then return null; end if;
  return round(v::numeric)::int;
exception when others then return null;
end $$;

-- Số nguyên kẹp trong [lo, hi]; hỏng hoặc thiếu thì null (least/greatest bỏ qua null nên không dùng trực tiếp được).
create or replace function remi.try_int_between(v text, lo int, hi int) returns integer
language sql immutable set search_path = '' as $$
  select case when remi.try_int(v) is null then null else least(greatest(remi.try_int(v), lo), hi) end
$$;

-- ---------------------------------------------------------------- tách tài liệu ra bảng
create or replace function remi.sync_state(p_user uuid, d jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  t jsonb; h jsonb; r jsonb; it jsonb; k text; v jsonb;
  new_id bigint; pos int;
begin
  delete from remi.tasks        where user_id = p_user;   -- cascade: task_items
  delete from remi.habits       where user_id = p_user;   -- cascade: habit_logs
  delete from remi.day_notes    where user_id = p_user;
  delete from remi.pantry_items where user_id = p_user;
  delete from remi.recipes      where user_id = p_user;   -- cascade: recipe_items
  delete from remi.meal_plans   where user_id = p_user;
  if d is null or jsonb_typeof(d) <> 'object' then return; end if;

  -- việc
  if jsonb_typeof(d->'tasks') = 'array' then
    for t in select value from jsonb_array_elements(d->'tasks') loop
      continue when jsonb_typeof(t) <> 'object' or coalesce(t->>'id', '') = '' or coalesce(trim(t->>'title'), '') = '';
      insert into remi.tasks (user_id, client_id, title, emoji, due_at, duration_min, lead_min, repeat, done, is_shopping, note)
      values (p_user, t->>'id', left(t->>'title', 200), left(coalesce(t->>'emoji', ''), 16), remi.try_ts(t->>'when'),
              remi.try_int_between(t->>'durMin', 0, 1440), remi.try_int_between(t->>'leadMin', 0, 10080),
              case when t->>'repeat' in ('daily', 'weekly') then t->>'repeat' else 'none' end,
              coalesce(t->'done' = 'true'::jsonb, false), coalesce(t->'shop' = 'true'::jsonb, false), left(coalesce(t->>'note', ''), 2000))
      on conflict (user_id, client_id) do nothing
      returning id into new_id;
      continue when new_id is null;
      if jsonb_typeof(t->'checklist') = 'array' then
        pos := 0;
        for it in select value from jsonb_array_elements(t->'checklist') loop
          continue when jsonb_typeof(it) <> 'object' or coalesce(trim(it->>'item'), '') = '';
          pos := pos + 1;
          insert into remi.task_items (task_id, position, item, qty, done)
          values (new_id, pos, left(it->>'item', 120), left(coalesce(it->>'qty', ''), 40), coalesce(it->'done' = 'true'::jsonb, false));
        end loop;
      end if;
    end loop;
  end if;

  -- thói quen và nhật ký
  if jsonb_typeof(d->'habits') = 'array' then
    for h in select value from jsonb_array_elements(d->'habits') loop
      continue when jsonb_typeof(h) <> 'object' or coalesce(h->>'id', '') = '' or coalesce(trim(h->>'title'), '') = '';
      insert into remi.habits (user_id, client_id, title, emoji, days, times, portion_ml, once)
      values (p_user, h->>'id', left(h->>'title', 200), left(coalesce(h->>'emoji', ''), 16),
              coalesce((select array_agg(distinct x::smallint order by x::smallint) from jsonb_array_elements_text(case when jsonb_typeof(h->'days') = 'array' then h->'days' else '[]' end) x where x ~ '^[0-6]$'), '{0,1,2,3,4,5,6}'),
              coalesce((select array_agg(left(x, 5)) from jsonb_array_elements_text(case when jsonb_typeof(h->'times') = 'array' then h->'times' else '[]' end) x), '{}'),
              nullif(greatest(remi.try_int(h->>'portionMl'), 0), 0), coalesce(h->'once' = 'true'::jsonb, false))
      on conflict (user_id, client_id) do nothing
      returning id into new_id;
      continue when new_id is null;
      if jsonb_typeof(h->'log') = 'object' then
        insert into remi.habit_logs (habit_id, day, count)
        select new_id, remi.try_date(e.key), remi.try_int(e.value #>> '{}')
        from jsonb_each(h->'log') e
        where remi.try_date(e.key) is not null and remi.try_int(e.value #>> '{}') > 0;
      end if;
    end loop;
  end if;

  -- ghi chú ngày
  if jsonb_typeof(d->'dayNotes') = 'object' then
    insert into remi.day_notes (user_id, day, note)
    select p_user, remi.try_date(e.key), left(e.value #>> '{}', 2000)
    from jsonb_each(d->'dayNotes') e
    where remi.try_date(e.key) is not null and jsonb_typeof(e.value) = 'string' and trim(e.value #>> '{}') <> '';
  end if;

  -- bếp: tủ đồ, món của tôi, thực đơn tuần
  if jsonb_typeof(d->'kitchen') = 'object' then
    if jsonb_typeof(d->'kitchen'->'stock') = 'array' then
      insert into remi.pantry_items (user_id, client_id, name, qty, expires_on)
      select p_user, x->>'id', left(x->>'name', 120), left(coalesce(x->>'qty', ''), 40), remi.try_date(x->>'exp')
      from jsonb_array_elements(d->'kitchen'->'stock') x
      where jsonb_typeof(x) = 'object' and coalesce(x->>'id', '') <> '' and coalesce(trim(x->>'name'), '') <> ''
      on conflict (user_id, client_id) do nothing;
    end if;

    if jsonb_typeof(d->'kitchen'->'recipes') = 'array' then
      for r in select value from jsonb_array_elements(d->'kitchen'->'recipes') loop
        continue when jsonb_typeof(r) <> 'object' or coalesce(r->>'id', '') = '' or coalesce(trim(r->>'name'), '') = '';
        insert into remi.recipes (user_id, client_id, name, servings, note)
        values (p_user, r->>'id', left(r->>'name', 120), least(greatest(coalesce(remi.try_int(r->>'servings'), 4), 1), 20), left(coalesce(r->>'note', ''), 2000))
        on conflict (user_id, client_id) do nothing
        returning id into new_id;
        continue when new_id is null;
        if jsonb_typeof(r->'items') = 'array' then
          insert into remi.recipe_items (recipe_id, position, item, qty)
          select new_id, row_number() over (), left(x->>'item', 120), left(coalesce(x->>'qty', ''), 40)
          from jsonb_array_elements(r->'items') x
          where jsonb_typeof(x) = 'object' and coalesce(trim(x->>'item'), '') <> '';
        end if;
      end loop;
    end if;

    if jsonb_typeof(d->'kitchen'->'meals') = 'object' then
      for k, v in select key, value from jsonb_each(d->'kitchen'->'meals') loop
        continue when jsonb_typeof(v) <> 'array' or remi.try_date(split_part(k, '|', 1)) is null or split_part(k, '|', 2) not in ('sang', 'trua', 'toi');
        insert into remi.meal_plans (user_id, day, slot, position, dish_id, dish_name, servings)
        select p_user, remi.try_date(split_part(k, '|', 1)), split_part(k, '|', 2), row_number() over (),
               x->>'d', left(coalesce(x->>'n', ''), 120), least(greatest(coalesce(remi.try_int(x->>'s'), 4), 1), 20)
        from jsonb_array_elements(v) x
        where jsonb_typeof(x) = 'object' and coalesce(x->>'d', '') <> '';
      end loop;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- trigger
-- Lỗi khi tách bảng KHÔNG được làm hỏng lần lưu của người dùng: bắt lỗi, ghi cảnh báo, giữ tài liệu JSON.
create or replace function remi.states_sync_trigger() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  begin
    perform remi.sync_state(new.user_id, new.data);
  exception when others then
    raise warning 'remi.sync_state lỗi cho %: %', new.user_id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists states_sync on remi.states;
create trigger states_sync
  after insert or update of data on remi.states
  for each row execute function remi.states_sync_trigger();

-- ---------------------------------------------------------------- bảo mật
alter table remi.tasks        enable row level security;
alter table remi.task_items   enable row level security;
alter table remi.habits       enable row level security;
alter table remi.habit_logs   enable row level security;
alter table remi.day_notes    enable row level security;
alter table remi.pantry_items enable row level security;
alter table remi.recipes      enable row level security;
alter table remi.recipe_items enable row level security;
alter table remi.meal_plans   enable row level security;
revoke all on remi.tasks, remi.task_items, remi.habits, remi.habit_logs, remi.day_notes,
              remi.pantry_items, remi.recipes, remi.recipe_items, remi.meal_plans from anon, authenticated;
revoke all on function remi.sync_state(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- dữ liệu sẵn có
select remi.sync_state(user_id, data) from remi.states;
