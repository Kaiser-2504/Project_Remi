/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ];

    if (process.env.NODE_ENV === 'production') {
      headers.push(
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            'font-src https://fonts.gstatic.com',
            "img-src 'self' data:",
            "connect-src 'self'",
            "manifest-src 'self'",
            "worker-src 'self'",
            "base-uri 'none'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      );
    }

    return [{ source: '/:path*', headers }];
  },
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
};
export default nextConfig;