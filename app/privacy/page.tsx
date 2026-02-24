import { getLegalDocument } from '@/src/lib/content-actions';
import LegalDocumentClient from '@/components/legal/LegalDocumentClient';

// プライバシーポリシーは頻繁に変わらないので1時間キャッシュ
export const revalidate = 3600;

// デフォルトコンテンツ（DBにデータがない場合のフォールバック）
const defaultPrivacyContent = '<p>プライバシーポリシーを読み込めませんでした。しばらくしてから再度お試しください。</p>';

export default async function WorkerPrivacyPage() {
    const doc = await getLegalDocument('PRIVACY', 'WORKER');

    const content = doc?.content || defaultPrivacyContent;
    const lastUpdated = doc?.published_at
        ? new Date(doc.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
        : '2025年1月1日';

    return (
        <LegalDocumentClient
            title="プライバシーポリシー"
            content={content}
            lastUpdated={lastUpdated}
        />
    );
}
