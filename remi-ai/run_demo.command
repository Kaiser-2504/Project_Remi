#!/bin/bash
# Bấm đúp vào file này để chạy demo trên Mac.
# Lần đầu Mac có thể chặn: bấm chuột phải vào file, chọn Mở (Open), rồi xác nhận.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 demo.py "$@"
else
  echo "Chưa thấy Python 3. Hãy cài Python 3 từ https://www.python.org rồi chạy lại."
fi
echo
read -n 1 -s -r -p "Nhấn phím bất kỳ để đóng cửa sổ..."
