"""Nhãn nào thì Remi làm gì. Đây là cầu nối giữa "mô hình đoán nhãn" và "ứng dụng Remi hành động"."""

# Dưới ngưỡng này, mô hình coi là "không chắc" và Remi nên hỏi lại người dùng (hoặc nhờ AI/bộ luật) thay vì tự đoán.
CONFIDENCE_THRESHOLD = 0.60

ACTIONS = {
    "nuoc": {
        "remi_intent": {"intent": "habit", "shopping": False},
        "mo_ta": "Mở form THÓI QUEN UỐNG NƯỚC (chia lượng nước, chọn khung giờ nhắc)",
    },
    "habit_khac": {
        "remi_intent": {"intent": "habit", "shopping": False},
        "mo_ta": "Mở form THÓI QUEN (chọn ngày trong tuần, giờ nhắc)",
    },
    "viec": {
        "remi_intent": {"intent": "task", "shopping": False},
        "mo_ta": "Mở form VIỆC CÓ GIỜ (ngày, giờ, nhắc trước)",
    },
    "di_cho": {
        "remi_intent": {"intent": "task", "shopping": True},
        "mo_ta": "Mở form VIỆC ĐI CHỢ kèm danh sách nguyên liệu",
    },
}


def action_for(label: str, confidence: float) -> dict:
    a = ACTIONS[label]
    unsure = confidence < CONFIDENCE_THRESHOLD
    return {
        "remi_intent": dict(a["remi_intent"]),
        "mo_ta": a["mo_ta"],
        "hoi_lai": unsure,
        "ket_luan": "Không chắc: Remi sẽ HỎI LẠI người dùng thay vì tự đoán" if unsure else a["mo_ta"],
    }
