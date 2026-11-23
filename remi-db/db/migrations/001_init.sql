-- Remi — migration khởi tạo (Người 1 / D1)
-- Chạy trên Supabase bằng kết nối TRỰC TIẾP (cổng 5432), không qua pooler.
-- An toàn khi chạy lại nhiều lần (idempotent).
--
-- Mọi bảng nằm trong schema "remi" (không phải "public") nên KHÔNG bị PostgREST
-- phơi ra API tự sinh, và bật RLS không có policy để chặn luôn vai trò anon.
-- Máy chủ Remi kết nối bằng vai trò chủ bảng (postgres) nên bỏ qua RLS và vẫn đọc ghi được.

create extension if not exists pgcrypto;      -- gen_random_uuid()

create schema if not exists remi;

-- 1. Người dùng -----------------------------------------------------------
create table if not exists remi.users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  pw_hash    text not null,
  created_at timestamptz not null default now()
);
-- email không phân biệt hoa thường: chỉ mục duy nhất trên lower(email)
create unique index if not exists users_email_key on remi.users (lower(email));

-- 2. Phiên đăng nhập ------------------------------------------------------
-- Lưu BĂM của token, không lưu token thô. Cookie giữ token thô.
create table if not exists remi.sessions (
  token_hash text primary key,
  user_id    uuid not null references remi.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on remi.sessions (user_id);
create index if not exists sessions_expires_idx on remi.sessions (expires_at);

-- 3. Trạng thái của mỗi người (một dòng/người), có phiên bản cho khoá lạc quan
create table if not exists remi.states (
  user_id    uuid primary key references remi.users(id) on delete cascade,
  version    integer not null default 0,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 4. Đăng ký nhận thông báo đẩy ------------------------------------------
create table if not exists remi.push_subs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references remi.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (endpoint)
);
create index if not exists push_subs_user_idx on remi.push_subs (user_id);

-- 5. Lời nhắc -------------------------------------------------------------
create table if not exists remi.reminders (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references remi.users(id) on delete cascade,
  key        text not null,                 -- khoá do giao diện đặt (id việc + loại nhắc)
  at         timestamptz not null,          -- thời điểm nhắc, luôn UTC
  title      text not null,
  body       text not null default '',
  sent_at    timestamptz,                   -- rỗng = chưa gửi
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
-- chỉ mục một phần: câu nhận lời nhắc chỉ đọc dòng chưa gửi
create index if not exists reminders_due_idx on remi.reminders (at) where sent_at is null;

-- 6. Bộ đếm lượt AI mỗi người mỗi ngày -----------------------------------
create table if not exists remi.ai_usage (
  user_id uuid not null references remi.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

-- 7. Giới hạn tần suất (đăng nhập, đăng ký, AI toàn hệ thống) -------------
create table if not exists remi.rate_limits (
  key          text primary key,            -- ví dụ 'login:<ip>' hoặc 'ai:global:<day>'
  window_start timestamptz not null,
  count        integer not null default 0
);

-- 8. Bật RLS trên MỌI bảng (không policy = chặn mọi truy cập qua API) -----
alter table remi.users       enable row level security;
alter table remi.sessions    enable row level security;
alter table remi.states      enable row level security;
alter table remi.push_subs   enable row level security;
alter table remi.reminders   enable row level security;
alter table remi.ai_usage    enable row level security;
alter table remi.rate_limits enable row level security;

-- 9. Thu hồi quyền của anon/authenticated trên schema remi (chắc ăn thêm)
revoke all on all tables in schema remi from anon, authenticated;
revoke all on schema remi from anon, authenticated;
