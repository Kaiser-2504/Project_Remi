"""Sinh wireframe low-fi (SVG) cho các màn của Remi.

    python3 docs/wireframes/make_wireframes.py

Sửa nội dung trong SCREENS rồi chạy lại để cập nhật mọi file .svg.
Màn bổ sung: gioi-thieu, lien-he. lich = trang /lich (lịch tháng); lich-tuan = bản vẽ lịch tuần cũ. Liên kết Giới thiệu và Liên hệ
nằm ở thanh điều hướng chung (thanh bên trên máy tính, góc phải trên điện thoại).
"""
from datetime import date, timedelta
from pathlib import Path
from html import escape

OUT = Path(__file__).parent
INK, MID, LIGHT, FILL, ACC = "#222", "#888", "#ccc", "#f2f2f2", "#5b6cff"
FONT = 'font-family="Helvetica, Arial, sans-serif"'
LINKS = ["Giới thiệu", "Liên hệ"]
LINKS_NOTE = "Liên kết Giới thiệu và Liên hệ có ở mọi trang: thanh bên (máy tính), góc trên phải (điện thoại)."


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


def field(x, y, w, label, placeholder, h=34, error=None):
    """Ô nhập của form: nhãn, khung, và (tuỳ chọn) dòng báo lỗi bên dưới."""
    s = t(x, y + 12, label, 12, weight="bold")
    s += box(x, y + 18, w, h, "#fff", "#d33" if error else MID, 6) + t(x + 10, y + 18 + 21, placeholder, 11, MID)
    if error:
        s += t(x, y + 18 + h + 14, error, 11, "#d33")
    return s


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
    """Tab Lịch của ứng dụng chính (xem tuần). Có nút Tháng mở trang /lich (lịch cả tháng).
    Điện thoại: cột hẹp (~47px) nên nhãn việc được rút gọn để không tràn ô, nút xếp xuống hàng riêng."""
    narrow = w < 500
    s = t(x, y + 18, "Lịch · Tuần 23–29/11", 18, weight="bold")
    if narrow:
        s += btn(x, y + 30, 70, "Tháng") + btn(x + 76, y + 30, 70, "Tuần", True) + btn(x + 152, y + 30, 70, "Ngày")
        s += note(x + 68, y + 32, 4, "")
        y += 40  # lưới và nút phía dưới dịch xuống
    else:
        s += btn(x + w - 226, y, 70, "Tháng") + btn(x + w - 150, y, 70, "Tuần", True) + btn(x + w - 76, y, 70, "Ngày")
        s += note(x + w - 158, y + 3, 4, "")
    cols = 7
    cw = w / cols
    for i, d in enumerate("T2 T3 T4 T5 T6 T7 CN".split()):
        s += t(x + i * cw + cw / 2, y + 52, d, 11, MID, anchor="middle")
    s += box(x, y + 60, w, 300, "#fff", LIGHT, 4)
    for i in range(1, cols):
        s += f'<line x1="{x+i*cw}" y1="{y+60}" x2="{x+i*cw}" y2="{y+360}" stroke="{FILL}"/>'
    for k, h in enumerate(range(7, 22, 3)):
        s += t(x + 2, y + 74 + k * 58, f"{h}h", 9, MID)
    short = {"Học": "Học", "Uống nước": "Nước", "Đi chợ": "Chợ", "Trùng!": "!", "Gym": "Gym"}
    blocks = [(0, 1, 40, "Học"), (2, 0.3, 50, "Uống nước"), (3, 2, 60, "Đi chợ"), (3, 2.4, 40, "Trùng!"), (5, 3.2, 50, "Gym")]
    for c, r, hh, lab in blocks:
        half = lab in ("Trùng!", "Đi chợ")
        bx = x + c * cw + 3 + (cw / 2 - 3 if lab == "Trùng!" else 0)
        bw = (cw / 2 - 4) if half else cw - 6
        col = "#ffd6d6" if lab == "Trùng!" else "#dfe3ff"
        text = short[lab] if narrow else lab  # điện thoại: nhãn ngắn để vừa ô
        s += box(bx, y + 66 + r * 58, bw, hh, col, ACC, 4) + t(bx + 3, y + 80 + r * 58, text, 8 if narrow else 9)
    s += note(x + 4 * cw + 10, y + 66 + 2 * 58 + 6, 1, "")
    s += btn(x, y + 372, 120, "Xuất .ics") + btn(x + 126, y + 372, 130, "Liên kết lịch")
    return s, ["Kéo thả việc sang giờ khác; trùng giờ thì tô đỏ và có nút Hoàn tác.", "Nhấn ngày để thêm ghi chú ngày.", "Xuất/nhập .ics và liên kết thuê bao lịch.", "Nút Tháng mở trang /lich: lịch cả tháng, chỉ xem. Trên điện thoại, nhãn việc rút gọn (Nước, Chợ, !) để không tràn ô; xem đầy đủ ở trang Tháng."]


def month(x, y, w):
    """Trang Next.js /lich (app/lich/page.jsx): lịch tháng chỉ xem, đọc từ CSDL.
    Máy tính: lưới tháng có chip việc. Điện thoại: ô chỉ còn vạch màu, danh sách việc theo ngày nằm dưới."""
    wide = w >= 500
    s = t(x, y + 18, "Tháng 11, 2026", 18, weight="bold") + t(x, y + 38, "Xíu, tháng này có 12 việc, đã xong 5.", 11, MID)
    s += btn(x, y + 50, 80, "‹ Trước") + btn(x + 86, y + 50, 90, "Tháng này") + btn(x + 182, y + 50, 70, "Sau ›")
    s += note(x + 268, y + 65, 2, "")
    cw, rh, gy = w / 7, (70 if wide else 48), y + 112
    for i, d in enumerate("T2 T3 T4 T5 T6 T7 CN".split()):
        s += t(x + i * cw + cw / 2, y + 106, d, 11, MID, anchor="middle")
    tasks = {3: [("07:00", "Đi chợ")], 12: [("08:00", "Uống nước"), ("14:00", "Hẹn khám")], 18: [("09:00", "Học bài*")],
             28: [("08:00", "Uống nước"), ("17:00", "Đi chợ"), ("20:00", "Học bài"), ("21:00", "Đọc sách")]}
    notes_d, today_d = {4: "Ghi chú"}, 28
    first = date(2026, 10, 26)
    for k in range(42):
        d = first + timedelta(days=k)
        r, c = divmod(k, 7)
        cx, cy = x + c * cw, gy + r * rh
        inm = d.month == 11
        s += box(cx, cy, cw, rh, "#fff" if inm else "#f6f6f6", LIGHT, 0)
        if inm and d.day == today_d:
            s += f'<circle cx="{cx+13}" cy="{cy+13}" r="9" fill="{ACC}"/>' + t(cx + 13, cy + 17, str(d.day), 10, "#fff", "bold", "middle")
        else:
            s += t(cx + 6, cy + 16, str(d.day), 10, INK if inm else LIGHT, "bold")
        if not inm:
            continue
        items = tasks.get(d.day, [])
        for j, (tm, ti) in enumerate(items[:3]):
            if wide:
                lab = f"{tm} {ti}"[:14]
                s += box(cx + 3, cy + 22 + j * 14, cw - 6, 12, "#dfe3ff", "none", 3, dash=ti.endswith("*")) + t(cx + 6, cy + 31 + j * 14, lab, 8)
            else:
                s += box(cx + 3, cy + 22 + j * 7, cw - 6, 5, "#aab4ff", "none", 2)
        if len(items) > 3:
            s += t(cx + 6, cy + (66 if wide else 47), f"+{len(items)-3} việc", 8 if wide else 7, MID)
        if d.day in notes_d:
            ny = cy + 22 + len(items[:3]) * (14 if wide else 7)
            s += box(cx + 3, ny, cw - 6, 12 if wide else 5, "#ffe3d3", "none", 3) + (t(cx + 6, ny + 9, notes_d[d.day], 8) if wide else "")
    s += note(x + 4 * cw - 2, gy + 4 * rh + 3, 1, "") if False else note(x + 6 * cw - 2, gy + 4 * rh + 12, 1, "")
    if wide:
        s += t(x, gy + 6 * rh + 22, "Việc có dấu * là việc lặp lại (chữ nghiêng). Thêm hoặc sửa việc ở trang chính.", 11, MID) + note(x + w - 10, gy + 6 * rh + 18, 3, "")
        return s, ["Vòng tròn màu: hôm nay. Mỗi ô tối đa 3 việc, dư thì ghi “+n việc”; ghi chú ngày có màu riêng.", "‹ Trước, Tháng này, Sau › đổi tháng bằng /lich?thang=YYYY-MM. Dữ liệu đọc từ CSDL của người dùng đang đăng nhập.", "Trang chỉ xem. Thêm hoặc sửa việc ở trang chính."]
    ay = gy + 6 * rh + 22
    s += t(x, ay, "Hôm nay, T7 28/11", 14, weight="bold") + note(x + w - 10, ay - 5, 3, "")
    for j, (tm, ti) in enumerate(tasks[28][:3]):
        yy = ay + 12 + j * 26
        s += f'<line x1="{x}" y1="{yy+22}" x2="{x+w}" y2="{yy+22}" stroke="{LIGHT}"/>' + t(x, yy + 15, tm, 11, MID) + t(x + 48, yy + 15, ti, 12)
    s += t(x, ay + 12 + 3 * 26 + 22, "Chủ nhật 29/11 …", 14, weight="bold")
    return s, ["Vòng tròn màu: hôm nay. Mỗi ô tối đa 3 việc; dư thì ghi “+n việc”; ghi chú ngày có màu riêng.", "‹ Trước, Tháng này, Sau › đổi tháng bằng /lich?thang=YYYY-MM. Dữ liệu đọc từ CSDL của người dùng đang đăng nhập.", "Điện thoại: ô chỉ còn vạch màu; danh sách việc theo ngày nằm bên dưới lưới."]


def about(x, y, w):
    wide = w >= 500
    s = t(x, y + 18, "Giới thiệu", 18, weight="bold")
    s += t(x, y + 52, "Trợ lý nhắc việc và thói quen cho cá nhân", 13, weight="bold")
    s += t(x, y + 72, "Nói một câu, Remi tạo nhắc hẹn, đi chợ, uống nước.", 11, MID)
    s += btn(x, y + 86, 100, "Dùng thử", True) + note(x + 116, y + 101, 1, "")
    if wide:
        s += img(x + w - 220, y + 36, 220, 110)
        fy = y + 170
        cw = (w - 16) / 3
        for i, (a, b) in enumerate([("Nhắc hẹn bằng giọng nói", "Nói một câu, AI tạo việc"), ("Đi chợ và thực đơn", "Gộp nguyên liệu cả tuần"), ("Thói quen uống nước", "Chia giờ theo lúc thức dậy")]):
            cx = x + i * (cw + 8)
            s += box(cx, fy, cw, 80, "#fff") + t(cx + 12, fy + 30, a, 12, weight="bold") + t(cx + 12, fy + 52, b, 11, MID)
        s += note(x + 12, fy, 2, "")
        ty = y + 290
    else:
        s += img(x, y + 130, w, 100)
        fy = y + 246
        s += rows(x, fy, w, [("Nhắc hẹn bằng giọng nói", "Nói một câu, AI tạo việc"), ("Đi chợ và thực đơn", "Gộp nguyên liệu cả tuần"), ("Thói quen uống nước", "Chia giờ theo lúc thức dậy")], check=False)
        s += note(x + w - 10, fy, 2, "")
        ty = y + 430
    s += t(x, ty, "Nhóm thực hiện", 14, weight="bold") + note(x + 124, ty - 5, 3, "")
    for i in range(4):
        ax = x + 30 + i * (w - 60) / 3
        s += f'<circle cx="{ax}" cy="{ty+36}" r="22" fill="#fff" stroke="{MID}"/>' + t(ax, ty + 78, "Họ tên", 11, anchor="middle") + t(ax, ty + 93, "Vai trò", 10, MID, anchor="middle")
    return s, ["Nút Dùng thử dẫn tới trang đăng nhập / đăng ký.", "Ba tính năng chính, mỗi thẻ một đến hai dòng.", "Danh sách nhóm lấy từ bảng phân vai (họ tên, vai trò)."]


def contact(x, y, w):
    wide = w >= 500
    fw = 340 if wide else w
    s = t(x, y + 18, "Liên hệ", 18, weight="bold")
    s += field(x, y + 36, fw, "Họ tên", "Nguyễn Văn A")
    s += field(x, y + 108, fw, "Email", "abc@gmail", error="Email chưa đúng định dạng") + note(x + fw - 10, y + 108 + 12, 1, "")
    s += field(x, y + 190, fw, "Chủ đề", "Góp ý ▾")
    s += t(x, y + 274, "Nội dung", 12, weight="bold") + box(x, y + 280, fw, 80, "#fff", MID, 6) + t(x + 10, y + 301, "Bạn muốn nhắn gì cho nhóm?", 11, MID)
    s += btn(x, y + 376, 90, "Gửi", True) + note(x + 106, y + 391, 2, "")
    s += t(x, y + 432, "Sau khi gửi: “Đã gửi. Nhóm sẽ trả lời qua email.”", 11, "#2a8a3c")
    ix, iy, iw = (x + 360, y + 54, w - 360) if wide else (x, y + 456, w)
    s += box(ix, iy, iw, 110 if not wide else 150, FILL, LIGHT, 8, True) + t(ix + 12, iy + 26, "Thông tin liên hệ", 13, weight="bold")
    s += t(ix + 12, iy + 52, "Email nhóm", 11, MID) + t(ix + 12, iy + 72, "GitHub: Project_Remi", 11, MID) + t(ix + 12, iy + 92, "Báo lỗi: tạo Issue", 11, MID) + note(ix + iw - 10, iy + 10, 3, "")
    return s, ["Kiểm tra form bằng JavaScript: ô trống hoặc sai định dạng thì báo lỗi ngay dưới ô, chưa gửi.", "Gửi xong hiện thông báo thành công và xoá nội dung form.", "Báo lỗi kỹ thuật: tạo Issue trên GitHub."]


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


# (khoá file, mục đang sáng ở thanh điều hướng, hàm nội dung, có cột phụ trên máy tính, nhãn ở chú thích)
SCREENS = [
    ("hom-nay", "Hôm nay", today, True, "Hôm nay"),
    ("lich", "Lịch", month, False, "Trang /lich: lịch tháng"),
    ("lich-tuan", "Lịch", cal, True, "Tab Lịch trong app chính (tuần)"),
    ("thoi-quen", "Thói quen", habits, True, "Thói quen"),
    ("bep", "Bếp", kitchen, True, "Bếp"),
    ("thong-ke", "Thống kê", stats, True, "Thống kê"),
    ("gioi-thieu", "Giới thiệu", about, False, "Giới thiệu"),
    ("lien-he", "Liên hệ", contact, False, "Liên hệ"),
]
NAV = ["Hôm nay", "Lịch", "Sắp tới", "Thói quen", "Bếp", "Thống kê"]


def annotations(x, y, notes):
    s = t(x, y, "Ghi chú hành vi", 13, weight="bold")
    yy = y + 28
    for i, n in enumerate(notes):
        lines = wrap(n, 44)
        s += note(x + 10, yy - 4, i + 1, "")
        for k, line in enumerate(lines):
            s += t(x + 28, yy + k * 15, line, 12, "#444")
        yy += len(lines) * 15 + 14  # khoảng cách theo số dòng, tránh chồng chú thích
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


def mobile(key, title, fn, aside=True, label=None):
    label = label or title
    W, H = 740, 760
    fx, fy, fw, fh = 20, 20, 360, 720
    body, notes = fn(fx + 16, fy + 60, fw - 32)
    notes = notes + [LINKS_NOTE]
    s = box(fx, fy, fw, fh, "#fff", INK, 28) + t(fx + 16, fy + 36, "Remi", 16, ACC, "bold")
    e = fx + fw - 16  # liên kết ở góc trên phải
    s += t(e, fy + 36, "Liên hệ", 10, ACC if title == "Liên hệ" else MID, "bold" if title == "Liên hệ" else "normal", "end")
    s += t(e - 47, fy + 36, "·", 10, MID, anchor="middle")
    s += t(e - 54, fy + 36, "Giới thiệu", 10, ACC if title == "Giới thiệu" else MID, "bold" if title == "Giới thiệu" else "normal", "end")
    s += note(e - 124, fy + 32, len(notes), "")
    s += body
    s += f'<line x1="{fx}" y1="{fy+fh-64}" x2="{fx+fw}" y2="{fy+fh-64}" stroke="{LIGHT}"/>'
    nw = fw / len(NAV)
    for i, n in enumerate(NAV):
        on = n == title
        s += f'<circle cx="{fx+nw*i+nw/2}" cy="{fy+fh-42}" r="9" fill="{ACC if on else FILL}"/>' + t(fx + nw * i + nw / 2, fy + fh - 18, n, 9, ACC if on else MID, "bold" if on else "normal", "middle")
    s += t(400, 40, label, 16, weight="bold") + t(400, 62, "Điện thoại (< 640px): một cột, thanh điều hướng dưới", 12, MID)
    s += annotations(400, 100, notes)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="100%" height="100%" fill="#fafafa"/>{s}</svg>'


def desktop(key, title, fn, aside=True, label=None):
    label = label or title
    W, H = 1240, 720
    s = box(20, 20, 1200, 680, "#fff", INK, 10)
    s += f'<rect x="20" y="20" width="200" height="680" rx="10" fill="{FILL}"/>' + t(40, 60, "Remi", 20, ACC, "bold")
    for i, n in enumerate(NAV):
        on = n == title
        s += box(32, 84 + i * 44, 176, 36, "#dfe3ff" if on else FILL, FILL, 8) + f'<circle cx="52" cy="{102+i*44}" r="8" fill="{ACC if on else LIGHT}"/>' + t(68, 107 + i * 44, n, 13, ACC if on else INK, "bold" if on else "normal")
    for i, n in enumerate(LINKS):  # liên kết chung ở cuối thanh bên
        on, yy = n == title, 612 + i * 34
        s += box(32, yy, 176, 28, "#dfe3ff" if on else FILL, FILL, 8) + t(48, yy + 19, n, 12, ACC if on else MID, "bold" if on else "normal")
    body, notes = fn(250, 50, 560)
    notes = notes + [LINKS_NOTE]
    s += body
    s += note(196, 626, len(notes), "")
    s += f'<line x1="840" y1="40" x2="840" y2="680" stroke="{FILL}"/>'
    if aside:
        s += t(860, 70, "Cột phụ (380px)", 14, weight="bold") + box(860, 84, 340, 120, FILL, LIGHT, 8, True) + t(1030, 150, "Tạo nhanh", 12, MID, anchor="middle")
        s += box(860, 216, 340, 160, FILL, LIGHT, 8, True) + t(1030, 300, "Thói quen hôm nay", 12, MID, anchor="middle")
        s += annotations(860, 410, notes)
    else:
        s += annotations(860, 70, notes)
    s += t(20, 716, f"{label} · máy tính (≥ 1280px): thanh bên có chữ" + (", hai cột" if aside else ", một cột nội dung"), 12, MID)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H+10}" width="{W}" height="{H+10}"><rect width="100%" height="100%" fill="#fafafa"/>{s}</svg>'


if __name__ == "__main__":
    for key, title, fn, aside, label in SCREENS:
        (OUT / f"{key}-mobile.svg").write_text(mobile(key, title, fn, aside, label), encoding="utf-8")
        (OUT / f"{key}-desktop.svg").write_text(desktop(key, title, fn, aside, label), encoding="utf-8")
        print("ok", key)