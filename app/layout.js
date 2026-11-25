// Trang chính của ứng dụng (/) là public/index.html (sinh từ web/).
// Layout này dùng cho các trang Next.js: /lich, /thong-ke, /gioi-thieu, /lien-he.
import './trang.css';

export const metadata = {
  title: 'Remi, trợ lý cá nhân',
  description: 'Trợ lý nhắc việc và thói quen: nói một câu, AI tạo nhắc hẹn, danh sách đi chợ, thói quen.',
  icons: { icon: '/icons/icon.svg' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#EE5A14' };

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
