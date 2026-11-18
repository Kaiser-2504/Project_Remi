/**
 * Gọi AI (Anthropic) để hiểu câu nói. Bản TypeScript của server/ai.js (Người 4, D5).
 *
 * Khác bản cũ:
 *  - Đầu vào và đầu ra đều qua Zod; kết quả AI không hợp lệ thì 502 ai_bad_output.
 *  - Thời gian chờ cấu hình được (AI_TIMEOUT_MS, mặc định 20 giây).
 *  - Lỗi phía AI được phân loại: quá thời gian / không kết nối / 5xx -> 503, AI báo quá tải (429) -> 503 kèm Retry-After.
 *    429 chỉ dành cho việc NGƯỜI DÙNG hết lượt trong ngày (ai_limit).
 */
import { ApiError } from './errors.ts';
import { aiResultSchema, type AiParseInput, type AiResult } from './schemas.ts';

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  dailyLimit: number;
}

export function aiConfigFromEnv(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    apiKey: env.ANTHROPIC_API_KEY || '',
    baseUrl: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
    model: env.AI_MODEL || 'claude-haiku-5-5',
    timeoutMs: Number(env.AI_TIMEOUT_MS) || 20000,
    dailyLimit: Number(env.AI_DAILY_LIMIT) || 60,
  };
}

/** Lời nhắc gửi cho AI. Nằm ở máy chủ nên người dùng không xem hay sửa được. */
export function buildPrompt({ text, now, weekday }: AiParseInput): string {
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

/** Tìm JSON trong câu trả lời của AI (có thể kèm chữ hay khối ```json). Ném 502 nếu không đọc được. */
export function extractJson(text: string): unknown {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw badOutput();
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    throw badOutput();
  }
}

const badOutput = () => new ApiError(502, 'ai_bad_output', 'AI trả về dữ liệu không đọc được.');

export async function parseIntent(
  cfg: AiConfig,
  input: AiParseInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AiResult> {
  if (!cfg.apiKey) throw new ApiError(503, 'ai_disabled', 'Máy chủ chưa bật AI.');
  let res: Response;
  try {
    res = await fetchImpl(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1200, messages: [{ role: 'user', content: buildPrompt(input) }] }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new ApiError(
      503,
      timedOut ? 'ai_timeout' : 'ai_unavailable',
      timedOut ? 'AI trả lời quá lâu, thử lại sau.' : 'Không kết nối được AI, thử lại sau.',
      {},
      { 'retry-after': '10' },
    );
  }
  if (res.status === 429) {
    throw new ApiError(503, 'ai_busy', 'AI đang quá tải, thử lại sau ít phút.', {}, { 'retry-after': res.headers.get('retry-after') || '30' });
  }
  if (!res.ok) {
    // Chi tiết từ AI (kể cả lỗi 4xx do cấu hình sai khóa) KHÔNG đi tới trình duyệt.
    throw new ApiError(res.status >= 500 ? 503 : 502, res.status >= 500 ? 'ai_unavailable' : 'ai_upstream', 'AI đang bận, thử lại sau.', {}, { 'retry-after': '10' });
  }
  let payload: { content?: Array<{ type: string; text?: string }> };
  try {
    payload = await res.json();
  } catch {
    throw badOutput();
  }
  const out = (payload.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
  const parsed = aiResultSchema.safeParse(extractJson(out));
  if (!parsed.success) throw new ApiError(502, 'ai_bad_output', 'AI trả về dữ liệu không hợp lệ.');
  return parsed.data;
}
