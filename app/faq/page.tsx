import { getFaqCategories } from '@/src/lib/content-actions';
import WorkerFaqClient from './WorkerFaqClient';

// FAQは頻繁に変わらないので1時間キャッシュ
export const revalidate = 3600;

export default async function WorkerFaqPage() {
    const categories = await getFaqCategories('WORKER');

    return <WorkerFaqClient categories={categories} />;
}
