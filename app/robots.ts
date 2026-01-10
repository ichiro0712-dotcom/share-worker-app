import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

/**
 * robots.txt を動的に生成
 * - /public/ 配下は許可（SEO用公開ページ）
 * - その他の認証必要ページは禁止
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
    // リクエストのホストからベースURLを取得
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || 'https://share-worker-app.vercel.app');

    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/public/'],
                disallow: [
                    '/admin/',
                    '/system-admin/',
                    '/mypage/',
                    '/messages/',
                    '/my-jobs/',
                    '/bookmarks/',
                    '/application-complete/',
                    '/login',
                    '/register/',
                    '/password-reset/',
                    '/api/',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
