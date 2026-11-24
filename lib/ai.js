'use strict';
const { HttpError } = require('./errors');

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const NOW_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Lời nhắc gửi cho AI. Nằm ở máy chủ nên người dùng không xem hay sửa được. */
function buildPrompt({ text, now, weekday }) {
  const clean = String(text).replace(/"""/g, '"');
  return [
    `Bạn là trợ lý của app quản lý cá nhân “Remi”. Bây giờ là ${weekday}, ${now} (giờ địa phương của người dùng).`,
    'Người dùng nhập một câu tiếng Việt tự nhiên. Hiểu ý và trả về DUY NHẤT một JSON hợp lệ (không markdown, không giải thích) theo mẫu:',
    '{"intent":"task"|"habit","title":"tên ngắn gọn","emoji":"1 emoji","when":"YYYY-MM-DDTHH:mm hoặc null","repeat":"none"|"daily"|"weekly","leadMinutes":0,"shopping":false,"servings":4,"assumption":"cực ngắn, tối đa 6 từ, ví dụ: 19:00 hôm nay","summary":"rỗng","checklist":[{"item":"tên","qty":"định lượng"}],"tips":["mẹo ngắn"],"habit":null|{"recurring":false,"times":["07:00"],"days":[0,1,2,3,4,5,6],"spread":null,"ml":null}}',
    'Quy tắc:',
    '- intent "habit" khi là thói quen lặp lại hằng ngày/hằng tuần (uống nước, giãn cơ, đi bộ, đọc sách, thiền...). Con số như “2 lít”, “5 phút” giữ trong title. Còn lại là "task", khi đó habit=null.',
    '- task: "when" là lúc việc diễn ra, luôn là mốc gần nhất SAU bây giờ. Nếu nói “7h” cho nấu ăn/bữa tối/đi chợ chiều thì hiểu là 19:00; việc buổi sáng thì 07:00. Nếu không nói giờ, chọn giờ hợp lý và ghi rõ trong assumption.',
    '- leadMinutes: nếu người dùng nói nhắc trước thì dùng đúng; nếu việc cần chuẩn bị (đi chợ, nấu ăn, di chuyển, họp) tự đề xuất 30–60; còn lại 0.',
    '- shopping=true khi là đi chợ/mua sắm/nấu ăn cần mua nguyên liệu. Khi đó checklist là các GỢI Ý nguyên liệu hoặc đồ cần mua kèm định lượng ngắn (cho 3–4 người nếu không nói số người, tối đa 8 mục; nếu không rõ món thì để mảng rỗng). Việc khác: shopping=false, checklist là mảng rỗng.',
    '- servings: số người ăn mà định lượng trong checklist tính cho (lấy từ câu nói, ví dụ “nấu cho 6 người”; không nói thì 4). Định lượng luôn ghi dạng số + đơn vị, ví dụ “500 g”, “3 củ”, “1 gói”, “1,5 lít”, để app tăng giảm được.',
    '- tips: tối đa 2 mẹo, mỗi mẹo dưới 10 từ; việc liên quan sức khỏe thì không đưa lời khuyên dài.',
    '- habit: recurring=true CHỈ khi người dùng nói rõ lặp lại (“mỗi ngày”, “hằng ngày”, “mỗi tuần”, “thứ 2, 4, 6”...). Nếu không nói gì thêm thì recurring=false (chỉ hôm nay). times là mốc nhắc HH:mm: nếu người dùng nêu giờ thì dùng đúng giờ đó; việc làm 1 lần (giãn cơ, thiền) không nêu giờ thì chọn 1 mốc hợp lý. days (0=Chủ nhật … 6=Thứ bảy): “thứ 2, 4, 6” = [1,3,5], “cuối tuần” = [6,0], mặc định đủ 7 ngày. Với việc chia nhỏ theo lượng (uống nước) dùng spread {"count":số lần,"from":"now"|"wake"|"HH:mm","to":"bed"|"HH:mm"} và times=[]: mỗi lần uống 250 ml nên count = số lít × 4 (1,5 lít = 6). from="now" nếu nói “từ bây giờ/từ đây”, from="wake" nếu lặp lại mỗi ngày; to là giờ người dùng nêu (“đến 9h tối” = "21:00") hoặc "bed". Nếu người dùng chia lượng nước thành N lần trong khoảng giờ A đến B (ví dụ “1 lít chia 4 lần từ 1h-5h”) thì spread {"count":N,"from":"13:00","to":"17:00"} (giờ 1 đến 5 không nói gì thêm hiểu là buổi chiều), times=[], và habit.ml là TỔNG lượng nước bằng ml (1 lít = 1000). Ví dụ “giãn cơ 5 phút mỗi ngày” → title “Giãn cơ 5 phút”, recurring true.',
    '- Mọi chữ bằng tiếng Việt, cực kỳ ngắn gọn, không giải thích dài dòng.',
    `Câu của người dùng: """${clean}"""`,
  ].join('\n');
}

function extractJson(text) {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new HttpError(502, 'ai_bad_output', 'AI trả về dữ liệu không đọc được.');
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new HttpError(502, 'ai_bad_output', 'AI trả về dữ liệu không đọc được.');
  }
}

function validateInput(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 300) throw new HttpError(400, 'bad_text', 'Câu nhập cần từ 1 đến 300 ký tự.');
  const now = String(body.now || '');
  if (!NOW_RE.test(now)) throw new HttpError(400, 'bad_now', 'Thiếu giờ hiện tại.');
  const weekday = WEEKDAYS.includes(body.weekday) ? body.weekday : '';
  if (!weekday) throw new HttpError(400, 'bad_weekday', 'Thiếu thứ trong tuần.');
  return { text, now, weekday };
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';

/** Có khoá AI nào được cấu hình không (Gemini hoặc Anthropic). */
function aiEnabled(cfg) {
  return !!(cfg.geminiKey || cfg.anthropicKey);
}

/** Gemini được ưu tiên khi có GEMINI_API_KEY (gói miễn phí); không thì dùng Anthropic. */
function provider(cfg) {
  return cfg.geminiKey ? 'gemini' : 'anthropic';
}

function buildRequest(cfg, prompt) {
  if (provider(cfg) === 'gemini') {
    const model = cfg.aiModel || DEFAULT_GEMINI_MODEL;
    const base = (cfg.geminiBase || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
    return {
      url: `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      // Khoá đi trong header, không đưa lên URL (URL hay bị ghi vào nhật ký).
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.geminiKey },
      body: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.2, responseMimeType: 'application/json' },
      },
    };
  }
  return {
    url: `${cfg.anthropicBase}/v1/messages`,
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: { model: cfg.aiModel || DEFAULT_ANTHROPIC_MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] },
  };
}

function readText(cfg, payload) {
  if (provider(cfg) === 'gemini') {
    const parts = (payload && payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts) || [];
    return parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
  }
  return ((payload && payload.content) || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

/** Gọi AI (Gemini hoặc Anthropic) và trả về JSON ý định đã kiểm tra sơ bộ. */
async function parseIntent(cfg, input, fetchImpl = fetch) {
  if (!aiEnabled(cfg)) throw new HttpError(503, 'ai_disabled', 'Máy chủ chưa bật AI.');
  const rq = buildRequest(cfg, buildPrompt(input));
  let res;
  try {
    res = await fetchImpl(rq.url, {
      method: 'POST',
      headers: rq.headers,
      body: JSON.stringify(rq.body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new HttpError(502, 'ai_unavailable', 'Không kết nối được AI.');
  }
  if (!res.ok) throw new HttpError(502, 'ai_upstream', 'AI đang bận, thử lại sau.', { upstream: res.status });
  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new HttpError(502, 'ai_bad_output', 'AI trả về dữ liệu không đọc được.');
  }
  const data = extractJson(readText(cfg, payload));
  if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 8000) {
    throw new HttpError(502, 'ai_bad_output', 'AI trả về dữ liệu không hợp lệ.');
  }
  return data;
}

module.exports = { aiEnabled, buildPrompt, parseIntent, validateInput, extractJson, WEEKDAYS };
