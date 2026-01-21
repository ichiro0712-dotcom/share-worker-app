import { getLaborDocument } from '@/src/lib/actions';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { DEFAULT_DISMISSAL_REASONS } from '@/constants/employment';
import { PrintButton } from './LaborDocumentClient';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

// 日付フォーマット関数
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

// 時刻フォーマット関数
function formatTime(timeString: string): string {
  return timeString.substring(0, 5);
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LaborDocumentPage({ params }: Props) {
  const { id } = await params;
  const data = await getLaborDocument(parseInt(id));

  if (!data) {
    notFound();
  }

  const { application, job, facility, user, dismissalReasons } = data;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Link href={`/my-jobs/${id}`} className="mr-4">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-lg font-bold">労働条件通知書</h1>
          </div>
          <PrintButton workerName={user.name} workDate={application.work_date} />
        </div>
      </div>

      {/* 労働条件通知書本文 */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6 print:shadow-none">
          {/* タイトル */}
          <div className="text-center border-b pb-4">
            <h2 className="text-xl font-bold">労働条件通知書</h2>
            <p className="text-sm text-gray-500 mt-2">
              発行日: {formatDate(new Date().toISOString())}
            </p>
          </div>

          {/* 使用者情報 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">使用者情報</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">使用者法人名</span>
                <span className="font-medium">{facility.corporation_name}</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">法人所在地</span>
                <span className="font-medium">
                  {facility.prefecture || ''}{facility.city || ''}{facility.address_detail || facility.address}
                </span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">事業所名称</span>
                <span className="font-medium">{facility.facility_name}</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">就業場所</span>
                <span className="font-medium">{job.address}</span>
              </div>
            </div>
          </section>

          {/* 労働者情報 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">労働者情報</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">労働者氏名</span>
                <span className="font-medium">{user.name} 殿</span>
              </div>
            </div>
          </section>

          {/* 契約情報 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">契約情報</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">就労日</span>
                <span className="font-medium">{formatDate(application.work_date)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">労働契約の期間</span>
                <span className="font-medium">1日（単発契約）</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">契約更新の有無</span>
                <span className="font-medium">有（ただし条件あり、都度契約）</span>
              </div>
            </div>
          </section>

          {/* 業務内容 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">業務内容</h3>
            <div className="text-sm">
              {job.work_content && job.work_content.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {job.work_content.map((content: string, index: number) => (
                    <li key={index}>{content}</li>
                  ))}
                </ul>
              ) : (
                <p>{job.overview || '詳細は施設からの指示に従ってください'}</p>
              )}
            </div>
          </section>

          {/* 勤務時間 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">勤務時間</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">始業時刻</span>
                <span className="font-medium">{formatTime(job.start_time)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">終業時刻</span>
                <span className="font-medium">{formatTime(job.end_time)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">休憩時間</span>
                <span className="font-medium">{job.break_time}分</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">所定時間外労働</span>
                <span className="font-medium">原則なし</span>
              </div>
            </div>
          </section>

          {/* 賃金 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">賃金</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">基本賃金</span>
                <span className="font-medium">時給 {job.hourly_wage.toLocaleString()}円</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">日給合計</span>
                <span className="font-medium text-red-500">{job.wage.toLocaleString()}円</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">諸手当（交通費）</span>
                <span className="font-medium">
                  {job.transportation_fee > 0
                    ? `${job.transportation_fee.toLocaleString()}円`
                    : 'なし'}
                </span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">時間外労働割増</span>
                <span className="font-medium">法定通り（25%増）</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">賃金支払日</span>
                <span className="font-medium">翌月末日払い</span>
              </div>
              <div className="flex">
                <span className="text-gray-600 w-32 shrink-0">支払方法</span>
                <span className="font-medium">銀行振込</span>
              </div>
            </div>
          </section>

          {/* 社会保険等 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">社会保険等</h3>
            <div className="text-sm">
              <p>単発契約のため、社会保険・雇用保険・労災保険の適用については、法定の要件に基づき判断されます。</p>
            </div>
          </section>

          {/* 持ち物・作業用品 */}
          {job.belongings && job.belongings.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-bold text-lg border-l-4 border-primary pl-3">作業用品その他</h3>
              <div className="text-sm">
                <ul className="list-disc list-inside space-y-1">
                  {job.belongings.map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* 受動喫煙防止措置 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">受動喫煙防止措置</h3>
            <div className="text-sm">
              <p>{facility.smoking_measure || '屋内禁煙（喫煙専用室あり）'}</p>
            </div>
          </section>

          {/* 解雇の事由 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">解雇の事由その他関連する事項</h3>
            <div className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {dismissalReasons || DEFAULT_DISMISSAL_REASONS}
            </div>
          </section>

          {/* 誓約事項 */}
          <section className="space-y-3">
            <h3 className="font-bold text-lg border-l-4 border-primary pl-3">誓約事項</h3>
            <div className="text-sm bg-gray-50 p-4 rounded-lg">
              <ul className="list-decimal list-inside space-y-2">
                <li>業務上知り得た秘密は、在職中のみならず退職後においても第三者に漏洩いたしません。</li>
                <li>利用者様の個人情報は適切に取り扱い、プライバシーを尊重いたします。</li>
                <li>施設の規則・指示に従い、誠実に業務を遂行いたします。</li>
                <li>遅刻・早退・欠勤の際は、速やかに連絡いたします。</li>
              </ul>
            </div>
          </section>

          {/* フッター */}
          <div className="pt-6 border-t text-center text-sm text-gray-500">
            <p>本書は労働基準法第15条に基づき、労働条件を明示するものです。</p>
            <p className="mt-2">発行: +TASTAS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
