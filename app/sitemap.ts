import { MetadataRoute } from 'next';
import { getPublicJobsForSitemap } from '@/src/lib/actions/job-public';

/**
 * sitemap.xml を動的に生成
 * - 公開中の通常求人のみを含む
 * - 求人の更新日時を lastModified に設定
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://share-worker-app.vercel.app';

    // 静的ページ
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
    ];

    // 公開求人ページ
    try {
        const jobs = await getPublicJobsForSitemap();

        const jobPages: MetadataRoute.Sitemap = jobs.map((job) => ({
            url: `${baseUrl}/public/jobs/${job.id}`,
            lastModified: job.lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.8,
        }));

        return [...staticPages, ...jobPages];
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return staticPages;
    }
}
