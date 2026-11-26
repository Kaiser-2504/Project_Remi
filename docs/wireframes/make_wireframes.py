"""Sinh wireframe low-fi (SVG) cho các màn chính của Remi.

    python3 docs/wireframes/make_wireframes.py

Sửa nội dung trong SCREENS rồi chạy lại để cập nhật mọi file .svg.
"""
from pathlib import Path
from html import escape

OUT = Path(__file__).parent
INK, MID, LIGHT, FILL, ACC = "#222", "#888", "#ccc", "#f2f2f2", "#5b6cff"
FONT = 'font-family="Helvetica, Arial, sans-serif"'


def t(x, y, s, size=13, color=INK, weight="normal", anchor="start"):
    return f'<text x="{x}" y="{y}" {FONT} font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(s)}</text>'


def box(x, y, w, h, fill=FILL, stroke=LIGHT, r=8, dash=False):
    d = ' stroke-dasharray="5 4"' if dash else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"{d}/>'


def img(x, y, w, h):
    return box(x, y, w, h, "#fff", MID, 4) + f'<line x1="{x}" y1="{y}" x2="{x+w}" y2="{y+h}" stroke="{LIGHT}"/><line x1="{x+w}" y1="{y}" x2="{x}" y2="{y+h}" stroke="{LIGHT}"/>'


def btn(x, y, w, label, primary=False):
    return box(x, y, w, 30, ACC if primary else "#fff", ACC, 15) + t(x + w / 2, y + 20, label, 12, "#fff" if primary else ACC, "bold", "middle")


def note(x, y, n, text):
    """Chú thích đánh số (màu cam) giải thích hành vi."""
    return f'<circle cx="{x}" cy="{y}" r="10" fill="#ff9f1c"/>' + t(x, y + 4, str(n), 11, "#fff", "bold", "middle")


def rows(x, y, w, items, h=44, check=True):
    out = []
    for i, (a, b) in enumerate(items):
        yy = y + i * (h + 8)
        out.append(box(x, yy, w, h, "#fff"))
        if check:
            out.append(f'<circle cx="{x+20}" cy="{yy+h/2}" r="8" fill="none" stroke="{MID}"/>')
        out.append(t(x + (38 if check else 12), yy + 19, a, 13))
        out.append(t(x + (38 if check else 12), yy + 35, b, 11, MID))
    return "".join(out)


# --- nội dung từng màn: hàm nhận (x, y, w) vùng nội dung, trả về (svg, ghi chú) ---

def today(x, y, w):
    s = t(x, y + 18, "Chào buổi sáng, Xíu", 18, weight="bold")
    s += box(x, y + 32, w, 54, "#fff") + t(x + 12, y + 55, "Ngủ 23:00  ━━━━●━━━  Dậy 6:30", 12) + t(x + 12, y + 74, "kéo để đổi giờ", 10, MID) + note(x + w - 14, y + 40, 1, "")
    s += box(x, y + 98, w, 46, "#fff", ACC, 23) + t(x + 16, y + 126, "Nói hoặc gõ: “mai 7h đi chợ mua thịt…”", 12, MID) + f'<circle cx="{x+w-23}" cy="{y+121}" r="15" fill="{ACC}"/>' + note(x + w - 14, y + 100, 2, "")
    s += btn(x, y + 154, 100, "Đặt nhắc hẹn") + btn(x + 106, y + 154, 80, "Hẹn lịch") + btn(x + 192, y + 154, min(110, w - 192), "Thêm thói quen")
    s += t(x, y + 210, "Hôm nay (4)", 14, weight="bold")
    s += rows(x, y + 220, w, [("Uống nước 250 ml", "9:00 · lần 1/4"), ("Đi chợ: thịt, rau, trứng", "17:00 · 3 món"), ("Học bài", "20:00 · nhắc trước 10 phút")])
    return s, ["Thanh ngủ/thức kéo bằng con trỏ, tính giờ uống nước theo giờ dậy.", "Ô nhập câu tự nhiên + nút micro; AI tách thành việc.", "Chạm một việc mở cửa sổ chi tiết (đáy màn trên điện thoại, giữa màn trên máy tính)."]


def cal(x, y, w):
    s = t(x, y + 18, "Lịch · Tháng 11", 18, weight="bold") + btn(x + w - 150, y, 70, "Tuần", True) + btn(x + w - 76, y, 70, "Ngày")
    cols = 7
    cw = w / cols
    for i, d in enumerate("T2 T3 T4 T5 T6 T7 CN".split()):
        s += t(x + i * cw + cw / 2, y + 52, d, 11, MID, anchor="middle")
    s += box(x, y + 60, w, 300, "#fff", LIGHT, 4)
    for i in range(1, cols):
        s += f'<line x1="{x+i*cw}" y1="{y+60}" x2="{x+i*cw}" y2="{y+360}" stroke="{FILL}"/>'
    for k, h in enumerate(range(7, 22, 3)):
        s += t(x + 2, y + 74 + k * 58, f"{h}h", 9, MID)
    blocks = [(0, 1, 40, "Học"), (2, 0.3, 50, "Uống nước"), (3, 2, 60, "Đi chợ"), (3, 2.4, 40, "Trùng!"), (5, 3.2, 50, "Gym")]
    for c, r, hh, lab in blocks:
        col = "#ffd6d6" if lab == "Trùng!" else "#dfe3ff"
        s += box(x + c * cw + 3 + (cw / 2 - 3 if lab == "Trùng!" else 0), y + 66 + r * 58, (cw / 2 - 4) if lab in ("Trùng!", "Đi chợ") else cw - 6, hh, col, ACC, 4) + t(x + c * cw + 6 + (cw / 2 - 3 if lab == "Trùng!" else 0), y + 80 + r * 58, lab, 9)
    s += note(x + 3.5 * cw, y + 66 + 2 * 58, 1, "")
    s += btn(x, y + 372, 120, "Xuất .ics") + btn(x + 126, y + 372, 130, "Liên kết lịch")
    return s, ["Kéo thả việc sang giờ khác; trùng giờ thì tô đỏ và có nút Hoàn tác.", "Nhấn ngày để thêm ghi chú ngày.", "Xuất/nhập .ics và liên kết thuê bao lịch."]


def habits(x, y, w):
    s = t(x, y + 18, "Thói quen", 18, weight="bold") + btn(x + w - 90, y, 90, "+ Thêm", True)
    items = [("Uống 2 lít nước", "8 lần × 250 ml · 🔥 12 ngày", 0.6), ("Đi bộ 30 phút", "T2 T4 T6 · 🔥 5 ngày", 1.0), ("Đọc sách", "Mỗi tối 21:00 · 🔥 0", 0.0)]
    for i, (a, b, p) in enumerate(items):
        yy = y + 44 + i * 96
        s += box(x, yy, w, 86, "#fff") + t(x + 14, yy + 24, a, 14, weight="bold") + t(x + 14, yy + 44, b, 11, MID)
        s += box(x + 14, yy + 56, w - 28, 10, FILL, FILL, 5) + box(x + 14, yy + 56, max(1, (w - 28) * p), 10, ACC, ACC, 5)
        s += t(x + w - 14, yy + 24, f"{int(p*100)}%", 13, ACC, "bold", "end")
    s += note(x + w - 10, y + 100, 1, "")
    return s, ["Thẻ thói quen: chuỗi ngày, tỉ lệ hoàn thành, thanh tiến độ hôm nay.", "Lặp theo ngày trong tuần; nhắc gọi đúng tên người dùng."]


def kitchen(x, y, w):
    s = t(x, y + 18, "Bếp", 18, weight="bold")
    tabs = ["Thực đơn tuần", "Tủ đồ", "Đi chợ", "Món của tôi"]
    tw = w / 4
    for i, lab in enumerate(tabs):
        s += box(x + i * tw + 2, y + 30, tw - 4, 30, ACC if i == 0 else "#fff", ACC, 15) + t(x + i * tw + tw / 2, y + 50, lab, 11, "#fff" if i == 0 else ACC, "bold", "middle")
    s += note(x + w - 6, y + 32, 1, "")
    s += box(x, y + 72, w, 56, "#fff8e6", "#ffcf66") + t(x + 12, y + 95, "Hôm nay nấu gì? Canh chua cá (đủ đồ trong tủ)", 12) + t(x + 12, y + 115, "Trứng sắp hết hạn: 2 ngày", 11, "#b26b00")
    days = "T2 T3 T4 T5 T6 T7 CN".split()
    gw = (w - 40) / 3
    s += t(x + 40 + gw * 0.5, y + 150, "Sáng", 11, MID, anchor="middle") + t(x + 40 + gw * 1.5, y + 150, "Trưa", 11, MID, anchor="middle") + t(x + 40 + gw * 2.5, y + 150, "Tối", 11, MID, anchor="middle")
    for i, d in enumerate(days):
        yy = y + 158 + i * 32
        s += t(x, yy + 19, d, 11, MID)
        for j in range(3):
            filled = (i + j) % 3 != 0
            s += box(x + 40 + j * gw + 2, yy, gw - 4, 26, "#fff" if filled else FILL, LIGHT, 4, dash=not filled) + (t(x + 46 + j * gw, yy + 17, ["Phở", "Cơm gà", "Canh chua"][j], 10) if filled else t(x + 40 + j * gw + gw / 2, yy + 17, "+", 12, MID, anchor="middle"))
    s += btn(x, y + 390, min(260, w), "Gộp thành danh sách đi chợ", True) + note(x + min(260, w) + 14, y + 405, 2, "")
    return s, ["Bốn mục con của tab Bếp.", "Gộp nguyên liệu cả tuần, trừ đồ đã có trong tủ, ra một danh sách đi chợ."]


def stats(x, y, w):
    s = t(x, y + 18, "Thống kê", 18, weight="bold") + btn(x + w - 150, y, 70, "Tuần", True) + btn(x + w - 76, y, 70, "Tháng")
    kw = (w - 16) / 3
    for i, (n, l) in enumerate([("86%", "hoàn thành"), ("12", "chuỗi ngày"), ("5", "huy hiệu")]):
        s += box(x + i * (kw + 8), y + 44, kw, 64, "#fff") + t(x + i * (kw + 8) + 12, y + 74, n, 22, weight="bold") + t(x + i * (kw + 8) + 12, y + 96, l, 11, MID)
    s += box(x, y + 120, w, 170, "#fff")
    bw = (w - 40) / 7
    for i, v in enumerate([0.5, 0.8, 0.6, 1.0, 0.7, 0.3, 0.9]):
        s += box(x + 20 + i * bw + 4, y + 270 - 130 * v, bw - 8, 130 * v, ACC, ACC, 3) + t(x + 20 + i * bw + bw / 2, y + 284, "T2 T3 T4 T5 T6 T7 CN".split()[i], 9, MID, anchor="middle")
    s += t(x, y + 316, "Huy hiệu", 14, weight="bold")
    for i in range(5):
        s += f'<circle cx="{x+24+i*52}" cy="{y+348}" r="20" fill="{FILL if i>2 else "#dfe3ff"}" stroke="{ACC if i<=2 else LIGHT}"/>'
    s += note(x + w - 10, y + 122, 1, "")
    return s, ["Biểu đồ việc hoàn thành theo ngày; đổi Tuần/Tháng.", "Huy hiệu chưa mở hiện màu xám; Remi đổi biểu cảm theo tiến độ."]


SCREENS = [("hom-nay", "Hôm nay", today), ("lich", "Lịch", cal), ("thoi-quen", "Thói quen", habits), ("bep", "Bếp", kitchen), ("thong-ke", "Thống kê", stats)]
NAV = ["Hôm nay", "Lịch", "Sắp tới", "Thói quen", "Bếp", "Thống kê"]


def annotations(x, y, notes):
    s = t(x, y, "Ghi chú hành vi", 13, weight="bold")
    for i, n in enumerate(notes):
        yy = y + 28 + i * 48
        s += note(x + 10, yy - 4, i + 1, "")
        for k, line in enumerate(wrap(n, 44)):
            s += t(x + 28, yy + k * 15, line, 12, "#444")
    return s


def wrap(s, n):
    out, cur = [], ""
    for w in s.split():
        if len(cur) + len(w) + 1 > n:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    return out + [cur]


def mobile(key, title, fn):
    W, H = 700, 760
    fx, fy, fw, fh = 20, 20, 360, 720
    body, notes = fn(fx + 16, fy + 60, fw - 32)
    s = box(fx, fy, fw, fh, "#fff", INK, 28) + t(fx + 16, fy + 36, "Remi", 16, ACC, "bold") + f'<circle cx="{fx+fw-30}" cy="{fy+30}" r="12" fill="{FILL}" stroke="{MID}"/>'
    s += body
    s += f'<line x1="{fx}" y1="{fy+fh-64}" x2="{fx+fw}" y2="{fy+fh-64}" stroke="{LIGHT}"/>'
    nw = fw / len(NAV)
    for i, n in enumerate(NAV):
        on = n == title
        s += f'<circle cx="{fx+nw*i+nw/2}" cy="{fy+fh-42}" r="9" fill="{ACC if on else FILL}"/>' + t(fx + nw * i + nw / 2, fy + fh - 18, n, 9, ACC if on else MID, "bold" if on else "normal", "middle")
    s += t(400, 40, f"{title} · điện thoại (< 640px)", 16, weight="bold") + t(400, 62, "Một cột, thanh điều hướng dưới", 12, MID)
    s += annotations(400, 100, notes)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="100%" height="100%" fill="#fafafa"/>{s}</svg>'


def desktop(key, title, fn):
    W, H = 1240, 720
    s = box(20, 20, 1200, 680, "#fff", INK, 10)
    s += f'<rect x="20" y="20" width="200" height="680" rx="10" fill="{FILL}"/>' + t(40, 60, "Remi", 20, ACC, "bold")
    for i, n in enumerate(NAV):
        on = n == title
        s += box(32, 84 + i * 44, 176, 36, "#dfe3ff" if on else FILL, FILL, 8) + f'<circle cx="52" cy="{102+i*44}" r="8" fill="{ACC if on else LIGHT}"/>' + t(68, 107 + i * 44, n, 13, ACC if on else INK, "bold" if on else "normal")
    body, notes = fn(250, 50, 560)
    s += body
    s += f'<line x1="840" y1="40" x2="840" y2="680" stroke="{FILL}"/>'
    s += t(860, 70, "Cột phụ (380px)", 14, weight="bold") + box(860, 84, 340, 120, FILL, LIGHT, 8, True) + t(1030, 150, "Tạo nhanh", 12, MID, anchor="middle")
    s += box(860, 216, 340, 160, FILL, LIGHT, 8, True) + t(1030, 300, "Thói quen hôm nay", 12, MID, anchor="middle")
    s += annotations(860, 410, notes)
    s += t(20, 716, f"{title} · máy tính (≥ 1280px): thanh bên có chữ, hai cột", 12, MID)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H+10}" width="{W}" height="{H+10}"><rect width="100%" height="100%" fill="#fafafa"/>{s}</svg>'


if __name__ == "__main__":
    for key, title, fn in SCREENS:
        (OUT / f"{key}-mobile.svg").write_text(mobile(key, title, fn), encoding="utf-8")
        (OUT / f"{key}-desktop.svg").write_text(desktop(key, title, fn), encoding="utf-8")
        print("ok", key)
