import { getLegalDocument } from '@/src/lib/content-actions';
import LegalDocumentClient from '@/components/legal/LegalDocumentClient';

// ビルド時のDB接続エラーを回避するため動的レンダリングに変更
export const dynamic = 'force-dynamic';

// デフォルトコンテンツ（DBにデータがない場合のフォールバック）
const defaultFacilityTermsContent = '<p>利用規約を読み込めませんでした。しばらくしてから再度お試しください。</p>';

export default async function FacilityTermsPage() {
    const doc = await getLegalDocument('TERMS', 'FACILITY');

    const content = doc?.content || defaultFacilityTermsContent;
    const lastUpdated = doc?.published_at
        ? new Date(doc.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
        : '2026年2月4日';

    return (
        <LegalDocumentClient
            title="利用規約（施設向け）"
            content={content}
            lastUpdated={lastUpdated}
        />
    );
}
