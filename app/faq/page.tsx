import { getFaqCategories } from '@/src/lib/content-actions';
import WorkerFaqClient from './WorkerFaqClient';

export default async function WorkerFaqPage() {
    const categories = await getFaqCategories('WORKER');

    return <WorkerFaqClient categories={categories} />;
}
