import { MetadataRoute } from 'next';

/**
 * robots.txt を動的に生成
 * - /public/ 配下は許可（SEO用公開ページ）
 * - その他の認証必要ページは禁止
 */
export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://share-worker-app.vercel.app';

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
