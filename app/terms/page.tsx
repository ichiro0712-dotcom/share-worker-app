import { getLegalDocument } from '@/src/lib/content-actions';
import LegalDocumentClient from '@/components/legal/LegalDocumentClient';

export const dynamic = 'force-dynamic';

// デフォルトコンテンツ（DBにデータがない場合に表示）
const defaultTermsContent = `
<section>
    <h2>第1条（適用）</h2>
    <p>本規約は、+TASTAS（以下「当サービス」といいます）の提供するワーカー向けサービスの利用に関する条件を、当サービスを利用するワーカー（以下「利用者」といいます）と当サービスとの間で定めるものです。</p>
</section>
<section>
    <h2>第2条（利用登録）</h2>
    <p>1. 利用者は、当サービスの定める方法によって利用登録を申請し、当サービスがこれを承認することによって、利用登録が完了するものとします。</p>
    <p>2. 当サービスは、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあります。</p>
    <ul>
        <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
        <li>本規約に違反したことがある者からの申請である場合</li>
        <li>その他、当サービスが利用登録を相当でないと判断した場合</li>
    </ul>
</section>
<section>
    <h2>第3条（アカウント管理）</h2>
    <p>1. 利用者は、自己の責任において、当サービスのアカウント情報を適切に管理するものとします。</p>
    <p>2. 利用者は、いかなる場合にも、アカウント情報を第三者に譲渡または貸与することはできません。</p>
</section>
`;

export default async function WorkerTermsPage() {
    const doc = await getLegalDocument('TERMS', 'WORKER');

    const content = doc?.content || defaultTermsContent;
    const lastUpdated = doc?.published_at
        ? new Date(doc.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
        : '2025年1月1日';

    return (
        <LegalDocumentClient
            title="利用規約"
            content={content}
            lastUpdated={lastUpdated}
        />
    );
}
