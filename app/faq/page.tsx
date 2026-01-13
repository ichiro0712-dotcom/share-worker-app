import { getFaqCategories } from '@/src/lib/content-actions';
import WorkerFaqClient from './WorkerFaqClient';

// ビルド時にDBアクセスを避けるため動的レンダリング
export const dynamic = 'force-dynamic';

export default async function WorkerFaqPage() {
    const categories = await getFaqCategories('WORKER');

    return <WorkerFaqClient categories={categories} />;
}
