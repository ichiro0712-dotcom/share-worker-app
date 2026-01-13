import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  // 重要: 開発環境でもService Workerを有効化（ローカルテスト用）
  disable: false,
  register: true,
  skipWaiting: true,
  // Service Workerのスコープ
  scope: '/',
  // カスタムService Workerを使用
  sw: 'sw.js',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Vercelでは画像最適化を有効化
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },
};

export default withPWA(nextConfig);
