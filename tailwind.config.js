// Tailwind CSS cho các trang Next.js (/lich, /thong-ke, /gioi-thieu, /lien-he). Xem docs/TAILWIND.md.
// Màu trỏ tới biến CSS trong app/trang.css nên chế độ tối đổi ở một chỗ, không cần viết lớp dark:.
const color = (name) => `var(--${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}'],
  theme: {
    // sm = 641px để `max-sm:` trùng mốc điện thoại (≤640px); wide = mốc chuyển sang nhiều cột.
    screens: { sm: '641px', wide: '860px' },
    extend: {
      colors: {
        bg: color('bg'),
        surface: color('surface'),
        ink: color('ink'),
        muted: color('muted'),
        line: color('line'),
        accent: { DEFAULT: color('accent'), soft: color('accent-soft'), text: color('accent-text') },
        ai: { DEFAULT: color('ai'), soft: color('ai-soft'), text: color('ai-text') },
        ok: color('ok'),
        bad: color('bad'),
      },
      boxShadow: { card: 'var(--shadow)' },
      spacing: { gutter: 'clamp(14px, 4vw, 40px)' },
      maxWidth: { page: '1100px' },
      fontFamily: { sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
