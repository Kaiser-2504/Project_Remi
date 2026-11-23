-- Remi — migration 002: bổ sung cho ứng dụng Next.js (khớp hợp đồng API hiện có)
-- An toàn khi chạy lại nhiều lần (idempotent). Chạy bằng kết nối TRỰC TIẾP/Session pooler (cổng 5432).

-- Tên gọi của người dùng (app gọi đúng tên: "Xíu ơi, đến giờ uống nước rồi nè!")
alter table remi.users add column if not exists name text not null default '';

-- Thông tin thiết bị (tuỳ chọn, để xem phiên/thiết bị nào đang đăng nhập)
alter table remi.sessions  add column if not exists ua text;
alter table remi.push_subs add column if not exists ua text;

-- Điều kiện gửi lời nhắc: '' = luôn gửi; 'asleep' = chỉ gửi khi người dùng đang ngủ (gọi dậy)
alter table remi.reminders add column if not exists cond text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reminders_cond_check') then
    alter table remi.reminders add constraint reminders_cond_check check (cond in ('', 'asleep'));
  end if;
end $$;

-- Dọn dữ liệu cũ. Gọi tay: select remi.housekeeping();  Hoặc để pg_cron gọi hằng đêm (xem db/cron.sql).
create or replace function remi.housekeeping() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  n_sessions int; n_sent int; n_stale int; n_ai int; n_rl int; n_cron int := 0;
begin
  delete from remi.sessions     where expires_at < now();                                  get diagnostics n_sessions = row_count;
  delete from remi.reminders    where sent_at is not null and sent_at < now() - interval '7 days'; get diagnostics n_sent = row_count;
  delete from remi.reminders    where sent_at is null and at < now() - interval '1 day';   get diagnostics n_stale = row_count;
  delete from remi.ai_usage     where day < current_date - 35;                            get diagnostics n_ai = row_count;
  delete from remi.rate_limits  where window_start < now() - interval '1 day';            get diagnostics n_rl = row_count;
  -- bảng nhật ký của pg_cron không tự dọn (chỉ có khi đã bật pg_cron)
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''7 days''';
    get diagnostics n_cron = row_count;
  end if;
  return jsonb_build_object('sessions', n_sessions, 'sent_reminders', n_sent, 'stale_reminders', n_stale,
                            'ai_usage', n_ai, 'rate_limits', n_rl, 'cron_runs', n_cron);
end $$;

-- Chỉ chủ bảng (postgres, pg_cron) gọi được; không để anon/authenticated gọi qua API.
revoke all on function remi.housekeeping() from public, anon, authenticated;
