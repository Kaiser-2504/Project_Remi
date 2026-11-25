-- Remi — migration 003: lời nhắn từ trang Liên hệ (/lien-he).
-- An toàn khi chạy lại nhiều lần. Chạy bằng kết nối TRỰC TIẾP/Session pooler (cổng 5432).

create table if not exists remi.contact_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid references remi.users(id) on delete set null,  -- có nếu người gửi đang đăng nhập
  name        text not null check (char_length(name) between 1 and 60),
  email       text not null check (char_length(email) between 3 and 200),
  topic       text not null default 'gop-y' check (topic in ('gop-y', 'loi', 'hop-tac', 'khac')),
  message     text not null check (char_length(message) between 10 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists contact_messages_created_idx on remi.contact_messages (created_at desc);

-- Giống các bảng khác: bật RLS, không policy, không cấp quyền cho anon/authenticated.
alter table remi.contact_messages enable row level security;
revoke all on remi.contact_messages from anon, authenticated;
