'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function TermsAndPrivacy() {
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
    <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">利用規約・プライバシーポリシー</h1>

          {/* 利用規約セクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 text-sm mb-8">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-3">利用規約</h2>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第1条（適用）</h3>
              <p className="text-gray-700 leading-relaxed">
                本規約は、+TASTAS（以下「当サービス」といいます）の提供する施設管理サービスの利用に関する条件を、
                当サービスを利用する施設管理者（以下「利用者」といいます）と当サービスとの間で定めるものです。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第2条（利用登録）</h3>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 利用者は、当サービスの定める方法によって利用登録を申請し、当サービスがこれを承認することによって、
                  利用登録が完了するものとします。
                </p>
                <p>
                  2. 当サービスは、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあり、
                  その理由については一切の開示義務を負わないものとします。
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
                  <li>本規約に違反したことがある者からの申請である場合</li>
                  <li>その他、当サービスが利用登録を相当でないと判断した場合</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第3条（アカウント管理）</h3>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 利用者は、自己の責任において、当サービスのアカウント情報（ID・パスワード等）を適切に管理するものとします。
                </p>
                <p>
                  2. 利用者は、いかなる場合にも、アカウント情報を第三者に譲渡または貸与し、
                  もしくは第三者と共用することはできません。
                </p>
                <p>
                  3. アカウント情報の管理不十分、使用上の過誤、第三者の使用等による損害の責任は利用者が負うものとし、
                  当サービスは一切の責任を負いません。
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第4条（禁止事項）</h3>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-2">利用者は、当サービスの利用にあたり、以下の行為をしてはなりません。</p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>法令または公序良俗に違反する行為</li>
                  <li>犯罪行為に関連する行為</li>
                  <li>当サービスの内容等、当サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為</li>
                  <li>当サービス、ほかの利用者、またはその他第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                  <li>当サービスによって得られた情報を商業的に利用する行為</li>
                  <li>当サービスのサービスの運営を妨害するおそれのある行為</li>
                  <li>不正アクセスをし、またはこれを試みる行為</li>
                  <li>他の利用者に関する個人情報等を収集または蓄積する行為</li>
                  <li>不正な目的を持って当サービスを利用する行為</li>
                  <li>その他、当サービスが不適切と判断する行為</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第5条（サービスの提供の停止等）</h3>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  当サービスは、以下のいずれかの事由があると判断した場合、利用者に事前に通知することなく
                  当サービスの全部または一部の提供を停止または中断することができるものとします。
                </p>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>当サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                  <li>地震、落雷、火災、停電または天災などの不可抗力により、当サービスの提供が困難となった場合</li>
                  <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                  <li>その他、当サービスが当サービスの提供が困難と判断した場合</li>
                </ul>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第6条（免責事項）</h3>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>
                  1. 当サービスは、当サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、
                  特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）が
                  ないことを明示的にも黙示的にも保証しておりません。
                </p>
                <p>
                  2. 当サービスは、当サービスに起因して利用者に生じたあらゆる損害について一切の責任を負いません。
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第7条（サービス内容の変更等）</h3>
              <p className="text-gray-700 leading-relaxed">
                当サービスは、利用者に通知することなく、当サービスの内容を変更しまたは当サービスの提供を中止することができるものとし、
                これによって利用者に生じた損害について一切の責任を負いません。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第8条（利用規約の変更）</h3>
              <p className="text-gray-700 leading-relaxed">
                当サービスは、必要と判断した場合には、利用者に通知することなくいつでも本規約を変更することができるものとします。
                なお、本規約の変更後、当サービスの利用を開始した場合には、当該利用者は変更後の規約に同意したものとみなします。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">第9条（準拠法・裁判管轄）</h3>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. 本規約の解釈にあたっては、日本法を準拠法とします。</p>
                <p>
                  2. 当サービスに関して紛争が生じた場合には、当サービスの本店所在地を管轄する裁判所を
                  専属的合意管轄とします。
                </p>
              </div>
            </section>
          </div>

          {/* プライバシーポリシーセクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 text-sm">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-3">プライバシーポリシー</h2>

            <section>
              <p className="text-gray-700 leading-relaxed mb-4">
                +TASTAS（以下「当サービス」といいます）は、利用者の個人情報の取扱いについて、
                以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">1. 個人情報の定義</h3>
              <p className="text-gray-700 leading-relaxed">
                「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、
                生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、
                連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、
                及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-3">2. 個人情報の収集方法</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">3. 個人情報を収集・利用する目的</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">4. 利用目的の変更</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">5. 個人情報の第三者提供</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">6. 個人情報の開示</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">7. 個人情報の訂正および削除</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">8. 個人情報の利用停止等</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">9. プライバシーポリシーの変更</h3>
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
              <h3 className="text-lg font-bold text-gray-900 mb-3">10. お問い合わせ窓口</h3>
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
  );
}
