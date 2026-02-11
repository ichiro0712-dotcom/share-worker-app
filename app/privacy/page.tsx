import { getLegalDocument } from '@/src/lib/content-actions';
import LegalDocumentClient from '@/components/legal/LegalDocumentClient';

// プライバシーポリシーは頻繁に変わらないので1時間キャッシュ
export const revalidate = 3600;

// デフォルトコンテンツ（DBにデータがない場合に表示）
const defaultPrivacyContent = `
<section>
    <p>+タスタス（以下「当サービス」といいます）は、利用者の個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。</p>
</section>
<section>
    <h2>1. 個人情報の定義</h2>
    <p>「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号等により特定の個人を識別できる情報を指します。</p>
</section>
<section>
    <h2>2. 個人情報の収集方法</h2>
    <p>当サービスは、利用者が利用登録をする際に、以下の個人情報をお尋ねすることがあります。</p>
    <ul>
        <li>氏名</li>
        <li>メールアドレス</li>
        <li>電話番号</li>
        <li>住所</li>
        <li>生年月日</li>
        <li>資格情報</li>
    </ul>
</section>
<section>
    <h2>3. 個人情報を収集・利用する目的</h2>
    <p>当サービスが個人情報を収集・利用する目的は、以下のとおりです。</p>
    <ul>
        <li>当サービスの提供・運営のため</li>
        <li>利用者からのお問い合わせに回答するため</li>
        <li>お仕事のマッチングを行うため</li>
        <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
    </ul>
</section>
`;

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
