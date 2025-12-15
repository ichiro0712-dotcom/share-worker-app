'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';

export default function Privacy() {
  const router = useRouter();
  const { isAdmin, admin } = useAuth();

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

  if (!isAdmin || !admin) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">プライバシーポリシー</h1>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 text-sm">
            <section>
              <p className="text-gray-700 leading-relaxed mb-4">
                +TASTAS（以下「当サービス」といいます）は、利用者の個人情報の取扱いについて、
                以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">1. 個人情報の定義</h2>
              <p className="text-gray-700 leading-relaxed">
                「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、
                生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、
                連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、
                及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">2. 個人情報の収集方法</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>当サービスは、利用者が利用登録をする際に、以下の個人情報をお尋ねすることがあります。</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>氏名</li>
                  <li>メールアドレス</li>
                  <li>電話番号</li>
                  <li>施設名、住所</li>
                  <li>その他当サービスが定める入力フォームに利用者が入力する情報</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">3. 個人情報を収集・利用する目的</h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-2">当サービスが個人情報を収集・利用する目的は、以下のとおりです。</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>当サービスの提供・運営のため</li>
                  <li>利用者からのお問い合わせに回答するため（本人確認を行うことを含む）</li>
                  <li>利用者が利用中のサービスの新機能、更新情報、キャンペーン等の案内のメールを送付するため</li>
                  <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
                  <li>利用規約に違反した利用者や、不正・不当な目的でサービスを利用しようとする利用者の特定をし、ご利用をお断りするため</li>
                  <li>利用者にご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため</li>
                  <li>上記の利用目的に付随する目的</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">4. 利用目的の変更</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 当サービスは、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、
                  個人情報の利用目的を変更するものとします。
                </p>
                <p>
                  2. 利用目的の変更を行った場合には、変更後の目的について、当サービス所定の方法により、
                  利用者に通知し、または本ウェブサイト上に公表するものとします。
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">5. 個人情報の第三者提供</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 当サービスは、次に掲げる場合を除いて、あらかじめ利用者の同意を得ることなく、
                  第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                  <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                  <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">6. 個人情報の開示</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  当サービスは、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。
                  ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、
                  開示しない決定をした場合には、その旨を遅滞なく通知します。
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合</li>
                  <li>当サービスの業務の適正な実施に著しい支障を及ぼすおそれがある場合</li>
                  <li>その他法令に違反することとなる場合</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">7. 個人情報の訂正および削除</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 利用者は、当サービスの保有する自己の個人情報が誤った情報である場合には、
                  当サービスが定める手続きにより、当サービスに対して個人情報の訂正、追加または削除（以下「訂正等」といいます）を請求することができます。
                </p>
                <p>
                  2. 当サービスは、利用者から前項の請求を受けてその請求に応じる必要があると判断した場合には、
                  遅滞なく、当該個人情報の訂正等を行うものとします。
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">8. 個人情報の利用停止等</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  当サービスは、本人から、個人情報が、利用目的の範囲を超えて取り扱われているという理由、
                  または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下「利用停止等」といいます）を
                  求められた場合には、遅滞なく必要な調査を行います。
                </p>
                <p>
                  前項の調査結果に基づき、その請求に応じる必要があると判断した場合には、遅滞なく、
                  当該個人情報の利用停止等を行います。
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">9. プライバシーポリシーの変更</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、
                  利用者に通知することなく、変更することができるものとします。
                </p>
                <p>
                  2. 当サービスが別途定める場合を除いて、変更後のプライバシーポリシーは、
                  本ウェブサイトに掲載したときから効力を生じるものとします。
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">10. お問い合わせ窓口</h2>
              <div className="text-gray-700 leading-relaxed">
                <p>本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。</p>
                <div className="mt-3 pl-4">
                  <p>メールアドレス: privacy@tastas.jp</p>
                  <p>担当部署: カスタマーサポート部</p>
                </div>
              </div>
            </section>

            <div className="pt-6 border-t border-gray-200 text-right text-xs text-gray-500">
              最終更新日: 2025年1月1日
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
