-- Remi — lịch chạy trong Supabase (pg_cron + pg_net). CHẠY TAY trong SQL Editor, không phải migration,
-- vì cần địa chỉ Vercel thật và bí mật. Làm sau khi đã deploy Vercel và đặt CRON_SECRET.
--
-- Cách hoạt động: mỗi phút pg_cron kiểm tra có lời nhắc đến hạn không; nếu có, pg_net gọi
-- POST https://<tên-miền>/api/cron/dispatch kèm "Authorization: Bearer <CRON_SECRET>".
-- Giờ trong cron tính theo UTC (02:30 giờ Việt Nam = 19:30 UTC hôm trước).

-- 0) Bật tiện ích (hoặc dùng Dashboard: Database > Extensions)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Cất địa chỉ và bí mật vào Vault. Thay giá trị thật, rồi chạy MỘT LẦN.
--    remi_cron_secret phải TRÙNG từng ký tự với biến CRON_SECRET trên Vercel (chỉ chữ và số, không khoảng trắng).
-- select vault.create_secret('https://<tên-miền>.vercel.app', 'remi_base_url');
-- select vault.create_secret('<CRON_SECRET>',                  'remi_cron_secret');

-- 2) Gửi lời nhắc: mỗi phút, và chỉ gọi Vercel khi có lời nhắc đến hạn.
--    timeout_milliseconds := 10000 vì mặc định của pg_net chỉ 2 giây (hàm Vercel khởi động lạnh dễ bị cắt).
select cron.schedule('remi-dispatch', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'remi_base_url') || '/api/cron/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'remi_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000)
  where exists (select 1 from remi.reminders
                where sent_at is null and at <= now() and at > now() - interval '30 minutes');
$$);

-- 3) Dọn dữ liệu cũ lúc 02:30 giờ Việt Nam.
select cron.schedule('remi-housekeeping', '30 19 * * *', $$ select remi.housekeeping(); $$);

-- Kiểm tra:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select id, status_code, timed_out, error_msg, created from net._http_response order by created desc limit 5;
-- Tạm dừng / gỡ:
--   select cron.unschedule('remi-dispatch');
