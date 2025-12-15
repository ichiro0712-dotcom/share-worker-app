'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';

export default function Terms() {
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">利用規約</h1>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 text-sm">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">第1条（適用）</h2>
              <p className="text-gray-700 leading-relaxed">
                本規約は、+TASTAS（以下「当サービス」といいます）の提供する施設管理サービスの利用に関する条件を、
                当サービスを利用する施設管理者（以下「利用者」といいます）と当サービスとの間で定めるものです。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">第2条（利用登録）</h2>
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
              <h2 className="text-lg font-bold text-gray-900 mb-3">第3条（アカウント管理）</h2>
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
              <h2 className="text-lg font-bold text-gray-900 mb-3">第4条（禁止事項）</h2>
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
              <h2 className="text-lg font-bold text-gray-900 mb-3">第5条（サービスの提供の停止等）</h2>
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
              <h2 className="text-lg font-bold text-gray-900 mb-3">第6条（免責事項）</h2>
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
              <h2 className="text-lg font-bold text-gray-900 mb-3">第7条（サービス内容の変更等）</h2>
              <p className="text-gray-700 leading-relaxed">
                当サービスは、利用者に通知することなく、当サービスの内容を変更しまたは当サービスの提供を中止することができるものとし、
                これによって利用者に生じた損害について一切の責任を負いません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">第8条（利用規約の変更）</h2>
              <p className="text-gray-700 leading-relaxed">
                当サービスは、必要と判断した場合には、利用者に通知することなくいつでも本規約を変更することができるものとします。
                なお、本規約の変更後、当サービスの利用を開始した場合には、当該利用者は変更後の規約に同意したものとみなします。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">第9条（準拠法・裁判管轄）</h2>
              <div className="text-gray-700 leading-relaxed space-y-2">
                <p>1. 本規約の解釈にあたっては、日本法を準拠法とします。</p>
                <p>
                  2. 当サービスに関して紛争が生じた場合には、当サービスの本店所在地を管轄する裁判所を
                  専属的合意管轄とします。
                </p>
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
