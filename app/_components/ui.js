// Chuỗi utility class của Tailwind dùng lặp lại giữa các trang.
// Luôn viết đủ tên lớp (không ghép chuỗi kiểu `text-${mau}`) để Tailwind quét được.
export const H1 = 'mb-1.5 text-[clamp(24px,4vw,32px)] font-bold leading-tight';
export const H2 = 'mb-3 text-[19px] font-bold';
export const MUTED = 'text-muted';
export const GRID2 = 'grid grid-cols-1 gap-4 wide:grid-cols-2';
export const LIST = 'list-disc pl-[18px]';
export const LI = 'my-1.5';

// CARD_BOX không có lề ngoài, để nơi nào cần lề khác thì tự thêm.
export const CARD_BOX = 'rounded-[18px] border border-line bg-surface p-[18px] shadow-card';
export const CARD = `${CARD_BOX} mb-4`;

const BTN_BASE = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] border px-[18px] py-2.5 text-[15px] font-semibold no-underline disabled:cursor-wait disabled:opacity-60';
export const BTN = `${BTN_BASE} border-accent bg-accent text-white`;
export const BTN_GHOST = `${BTN_BASE} border-line bg-surface text-accent-text`;

export const PAGE_HEAD = 'mb-[18px] flex flex-wrap items-end justify-between gap-4';
export const ACTIONS = 'flex flex-wrap gap-2';
