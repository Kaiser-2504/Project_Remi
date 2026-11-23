// Ứng dụng giao diện nằm trong public/index.html (sinh từ web/). Next.js chỉ cần layout gốc tối thiểu này.
export const metadata = { title: 'Remi, trợ lý cá nhân' };

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
