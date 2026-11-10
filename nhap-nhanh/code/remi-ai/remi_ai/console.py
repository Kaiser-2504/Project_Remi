"""Sửa lỗi bảng mã của cửa sổ dòng lệnh, nhất là trên Windows.

Khi dữ liệu đi qua đường ống hoặc tệp (ví dụ `echo ... | python demo.py`, hay test chạy demo), Python trên
Windows mặc định dùng bảng mã cp1252 và sập khi gặp tiếng Việt (ví dụ chữ "ọ" trong "họp"):
    UnicodeDecodeError: 'charmap' codec can't decode byte 0x8d
Hàm này ép đầu vào, đầu ra và đầu báo lỗi dùng UTF-8. Cửa sổ dòng lệnh Windows (console) vốn đã dùng UTF-8
nên lệnh này không làm gì có hại ở đó.
"""
import sys


def fix_stdio():
    for name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, name, None)
        if stream is None or not hasattr(stream, "reconfigure"):
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace" if name == "stdin" else "strict")
        except (ValueError, OSError):
            pass
