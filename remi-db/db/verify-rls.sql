-- verify-rls.sql — kiểm tra MỌI bảng trong schema remi đã bật RLS.
-- Chạy: npm run verify:rls
-- Thoát với lỗi nếu có bảng chưa bật RLS.
do $$
declare bad text;
begin
  select string_agg(tablename, ', ') into bad
  from pg_tables where schemaname = 'remi' and rowsecurity = false;
  if bad is not null then
    raise exception 'CÓ BẢNG CHƯA BẬT RLS: %', bad;
  end if;
  raise notice 'OK: mọi bảng trong schema remi đã bật RLS.';
end $$;

-- In bảng trạng thái để nhìn bằng mắt
select tablename as "bảng", rowsecurity as "rls_bật"
from pg_tables where schemaname = 'remi' order by tablename;
