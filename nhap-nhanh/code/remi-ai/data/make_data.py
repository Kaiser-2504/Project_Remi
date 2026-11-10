"""Sinh dữ liệu mẫu từ khuôn câu để có cái chạy ngay. ĐÂY CHỈ LÀ ĐIỂM XUẤT PHÁT:
dữ liệu sinh từ khuôn thì tập kiểm tra sinh từ cùng khuôn sẽ cho điểm cao ảo. Điểm thật chỉ có
khi đo trên câu do NGƯỜI viết độc lập (xem data/test_hand.csv và README.md).

  python data/make_data.py                 # ghi data/train.csv và data/test_synth.csv
"""
import csv
import os
import random
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE

DISHES = ["cà ri gà", "canh chua", "phở bò", "bún chả", "thịt kho tàu", "bún bò", "bánh xèo", "cơm chiên", "gà nướng", "canh rau muống",
          "cá kho", "lẩu thái", "mì xào", "chả giò", "súp bí đỏ"]
ITEMS = ["thịt ba chỉ", "hành tây", "cà chua", "nước mắm", "nước tương", "trứng", "sữa tươi", "rau muống", "thịt bò", "cá basa", "gạo",
         "dầu ăn", "đường", "muối", "hành lá", "ớt", "nước dừa", "tỏi", "gừng", "bí đỏ", "đậu hũ", "nấm rơm"]
WHO = ["bố", "mẹ", "chị Lan", "anh Nam", "cô giáo", "sếp", "khách", "bà", "bạn Hoa"]
HABITS = ["đi bộ {m} phút", "thiền {m} phút", "tập yoga", "đọc sách {m} phút", "viết nhật ký", "học từ vựng tiếng Anh", "giãn cơ cổ",
          "chạy bộ", "tập gym", "luyện đàn {m} phút", "tưới cây", "dọn bàn làm việc", "hít thở sâu", "ăn một quả táo", "gọi cho {who}",
          "uống vitamin", "uống thuốc", "đánh đàn", "tập thể dục {m} phút", "dắt chó đi dạo", "viết lời biết ơn"]
EVENTS = ["họp nhóm", "họp phụ huynh", "hẹn nha sĩ", "đón con", "nộp báo cáo", "gửi email cho {who}", "gọi lại cho {who}", "khám bác sĩ",
          "đi sân bay", "cắt tóc", "nộp đồ án", "họp online", "lấy đồ giặt ủi", "đóng tiền điện", "thi cuối kỳ", "đi đám cưới", "đặt vé máy bay",
          "thanh toán học phí", "mua nước hoa tặng {who}", "mua vé xem phim", "mang chìa khoá", "tắt bếp", "gặp {who}", "trả sách thư viện"]
DAYS = ["thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy", "chủ nhật"]


def money(r):
    return r.choice([1, 1.5, 2, 2.5, 3])


def lit(r):
    v = money(r)
    s = str(v).replace(".", r.choice([",", "."]))
    return s + " " + r.choice(["lít", "lít", "l", "lit"])


def hour(r):
    h = r.randint(5, 21)
    per = "sáng" if h < 11 else "trưa" if h < 13 else "chiều" if h < 18 else "tối"
    h12 = h if h <= 12 else h - 12
    return r.choice([f"{h12}h {per}", f"{h12} giờ {per}", f"{h}h", f"{h12}h"])


def when(r):
    return r.choice(["mai", "hôm nay", "chiều nay", "tối nay", "sáng mai", r.choice(DAYS), r.choice(DAYS) + " tuần sau", "ngày " + str(r.randint(1, 28))])


def water(r):
    k = r.randint(2, 8)
    a = r.randint(6, 12)
    t = [
        lambda: f"uống nước {lit(r)} mỗi ngày",
        lambda: f"uống đủ {lit(r)} nước",
        lambda: f"uống {r.choice([200, 250, 300, 500])}ml nước chia {k} lần từ {a}h đến {a + r.randint(3, 9)}h",
        lambda: f"mỗi {r.choice(['1', '2', '1,5'])} tiếng uống một ly nước",
        lambda: f"uống nước {k} lần một ngày",
        lambda: f"uống {r.randint(4, 10)} ly nước mỗi ngày",
        lambda: f"uống {r.randint(2, 6)} cốc nước {r.choice(['hôm nay', 'mỗi ngày', 'trong giờ làm'])}",
        lambda: f"uống nước từ bây giờ đến {r.randint(18, 22)}h đủ {lit(r)}",
        lambda: f"nhắc uống nước đều đặn {r.choice(['cả ngày', 'trong giờ làm', 'mỗi ngày'])}",
        lambda: f"uống chai nước {r.choice([350, 500, 750])}ml trước {r.randint(14, 21)}h",
        lambda: f"uống ly nước ấm {r.choice(['đầu ngày', 'mỗi sáng', 'khi thức dậy'])}",
        lambda: f"bổ sung nước {lit(r)} {r.choice(['hôm nay', 'mỗi ngày'])}",
        lambda: f"cứ {r.choice([60, 90, 120])} phút nhắc uống nước",
        lambda: f"uống nước lúc {hour(r)} {hour(r)} {hour(r)}",
        lambda: f"mình hay quên uống nước {r.choice(['nhắc giúp mình', 'nhắc với', 'hãy nhắc nhé'])}",
        lambda: f"uống {r.choice([300, 400, 500])}ml nước sau khi {r.choice(['tập thể dục', 'ăn cơm', 'chạy bộ'])}",
    ]
    return r.choice(t)()


def habit(r):
    h = r.choice(HABITS).format(m=r.choice([5, 10, 15, 20, 30]), who=r.choice(WHO))
    rep = r.choice(["mỗi ngày", "hằng ngày", "mỗi sáng", "mỗi tối", "mỗi trưa", "mỗi chiều", "mỗi cuối tuần",
                    "thứ 2 4 6", "thứ 3 và thứ 5", f"{r.randint(2, 5)} buổi mỗi tuần", "vào mỗi " + r.choice(DAYS), "trước khi ngủ", "sau khi ăn sáng"])
    return r.choice([f"{h} {rep}", f"{rep} {h}", f"{h} {rep}", f"nhắc tôi {h} {rep}"])


def task(r):
    e = r.choice(EVENTS).format(who=r.choice(WHO))
    shape = r.randint(0, 5)
    if shape == 0:
        return f"{when(r)} {hour(r)} {e}"
    if shape == 1:
        return f"{hour(r)} {when(r)} {e}"
    if shape == 2:
        return f"{e} lúc {hour(r)} {when(r)}"
    if shape == 3:
        return f"{e} trước {hour(r)} {when(r)}"
    if shape == 4:
        return f"sau {r.choice([10, 20, 30, 45])} phút {e}"
    return f"uống thuốc lúc {hour(r)}" if r.random() < 0.3 else f"{r.choice([1, 2, 3])} tiếng nữa {e}"


def shop(r):
    d = r.choice(DISHES)
    its = r.sample(ITEMS, 2)
    t = [
        lambda: f"đi chợ nấu {d}",
        lambda: f"mua {its[0]} và {its[1]}",
        lambda: f"vợ nhờ đi chợ nấu {d} lúc {hour(r)}",
        lambda: f"chuẩn bị nguyên liệu nấu {d}",
        lambda: f"đi siêu thị mua {its[0]} {its[1]}",
        lambda: f"{when(r)} nấu {d} cho {r.randint(2, 8)} người",
        lambda: f"mua {r.choice([200, 300, 500])}g {its[0]}",
        lambda: f"mua {r.randint(1, 3)} {r.choice(['bó', 'kg', 'chai', 'hộp', 'túi'])} {its[0]}",
        lambda: f"đi chợ {r.choice(['chiều nay', 'cuối tuần', 'sáng mai', 'lúc ' + hour(r)])}",
        lambda: f"ghé siêu thị mua {its[0]} nấu {d}",
        lambda: f"mua đồ làm {d}",
        lambda: f"danh sách đi chợ: {its[0]}, {its[1]}",
    ]
    return r.choice(t)()


GEN = {"nuoc": water, "habit_khac": habit, "viec": task, "di_cho": shop}
PRE = ["", "", "", "nhắc tôi ", "nhắc mình ", "xíu ơi ", "giúp mình ", "nhớ ", "hãy "]
SUF = ["", "", "", " nhé", " nha", " giúp mình", " đi", " với", " nhé em"]


def strip_marks(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def typo(r, s):
    w = s.split(" ")
    i = r.randrange(len(w))
    if len(w[i]) > 3:
        j = r.randrange(len(w[i]) - 1)
        w[i] = w[i][:j] + w[i][j + 1] + w[i][j] + w[i][j + 2:]
    return " ".join(w)


def one(r, label):
    s = GEN[label](r)
    s = r.choice(PRE) + s + r.choice(SUF)
    if r.random() < 0.28:
        s = strip_marks(s)
    if r.random() < 0.08:
        s = typo(r, s)
    if r.random() < 0.25:
        s = s[:1].upper() + s[1:]
    return " ".join(s.split())


def make(seed, per_class, avoid=()):
    r = random.Random(seed)
    seen = set(avoid)
    rows = []
    for label in GEN:
        n = 0
        tries = 0
        while n < per_class and tries < per_class * 40:
            tries += 1
            s = one(r, label)
            if s.lower() in seen:
                continue
            seen.add(s.lower())
            rows.append((s, label))
            n += 1
    r.shuffle(rows)
    return rows


def write(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["text", "label"])
        w.writerows(rows)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    train = make(1, 600)
    test = make(2, 200, avoid=[t.lower() for t, _ in train])
    write(os.path.join(OUT, "train.csv"), train)
    write(os.path.join(OUT, "test_synth.csv"), test)
    print(f"train.csv: {len(train)} câu, test_synth.csv: {len(test)} câu")
    for t, l in train[:8]:
        print(f"  [{l}] {t}")
