import puppeteer from 'puppeteer';
import { prisma } from '@/lib/prisma';
import { LABOR_TEMPLATE_VARIABLES } from '@/src/constants/labor-template';

interface LaborDocumentData {
  application: {
    id: number;
    status: string;
    work_date: string;
    created_at: string;
  };
  user: {
    id: number;
    name: string;
  };
  job: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    break_time: number;
    wage: number;
    hourly_wage: number;
    transportation_fee: number;
    address: string | null;
    overview: string | null;
    work_content: string[];
    belongings: string[];
  };
  facility: {
    id: number;
    corporation_name: string;
    facility_name: string;
    address: string | null;
    prefecture: string | null;
    city: string | null;
    address_detail: string | null;
    smoking_measure: string | null;
  };
  dismissalReasons: string | null;
}

interface TemplateSettings {
  template_content: string;
  accent_color: string;
}

// デフォルトテンプレート設定（system-actions.tsと同じ内容だが、フォールバック用）
const DEFAULT_TEMPLATE: TemplateSettings = {
  accent_color: '#3B82F6',
  template_content: `労働条件通知書

発行日: {{発行日}}

■ 使用者情報
使用者法人名: {{法人名}}
事業所名称: {{施設名}}
法人所在地: {{所在地}}
就業場所: {{就業場所}}

■ 労働者情報
労働者氏名: {{ワーカー名}} 殿

■ 契約情報
就労日: {{就労日}}
労働契約の期間: 1日（単発契約）
契約更新の有無: 有（ただし条件あり、都度契約）

■ 業務内容
{{業務内容}}

■ 勤務時間
始業時刻: {{始業時刻}}
終業時刻: {{終業時刻}}
休憩時間: {{休憩時間}}
所定時間外労働: 原則なし

■ 賃金
基本賃金: 時給 {{時給}}
日給合計: {{日給}}
諸手当（交通費）: {{交通費}}
時間外労働割増: 法定通り（25%増）
賃金支払日: 翌月末日払い
支払方法: 銀行振込

■ 社会保険等
単発契約のため、社会保険・雇用保険・労災保険の適用については、法定の要件に基づき判断されます。

■ 作業用品その他
{{持ち物}}

■ 受動喫煙防止措置
{{喫煙対策}}

■ 解雇の事由その他関連する事項
当社では、以下に該当する場合、やむを得ず契約解除となる可能性がございます。

【即時契約解除となる事由】
・正当な理由なく無断欠勤が続いた場合
・業務上の重大な過失または故意による事故を起こした場合
・利用者様や他の職員に対する暴力行為、ハラスメント行為があった場合
・業務上知り得た秘密を漏洩した場合
・犯罪行為により逮捕または起訴された場合

■ 誓約事項
1. 業務上知り得た秘密は、在職中のみならず退職後においても第三者に漏洩いたしません。
2. 利用者様の個人情報は適切に取り扱い、プライバシーを尊重いたします。
3. 施設の規則・指示に従い、誠実に業務を遂行いたします。
4. 遅刻・早退・欠勤の際は、速やかに連絡いたします。

---
本書は労働基準法第15条に基づき、労働条件を明示するものです。
発行: S WORKS`
};

/**
 * DBからテンプレート設定を取得（なければデフォルト）
 */
async function getTemplateSettings(): Promise<TemplateSettings> {
  try {
    const template = await prisma.laborDocumentTemplate.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!template) {
      return DEFAULT_TEMPLATE;
    }

    return {
      template_content: template.template_content,
      accent_color: template.accent_color,
    };
  } catch (error) {
    console.error('Failed to load template settings:', error);
    return DEFAULT_TEMPLATE;
  }
}

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

// HTMLエスケープ関数
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 労働条件通知書のHTMLを生成（テンプレート対応版）
 */
function generateHtml(data: LaborDocumentData, templateSettings: TemplateSettings): string {
  const facilityAddress = `${data.facility.prefecture || ''}${data.facility.city || ''}${data.facility.address_detail || data.facility.address || ''}`;

  // 変数マップの作成
  const variables: Record<string, string> = {
    '{{法人名}}': data.facility.corporation_name,
    '{{施設名}}': data.facility.facility_name,
    '{{所在地}}': facilityAddress,
    '{{就業場所}}': data.job.address || '',
    '{{ワーカー名}}': data.user.name,
    '{{就労日}}': formatDate(data.application.work_date),
    '{{始業時刻}}': formatTime(data.job.start_time),
    '{{終業時刻}}': formatTime(data.job.end_time),
    '{{休憩時間}}': `${data.job.break_time}分`,
    '{{時給}}': `${data.job.hourly_wage.toLocaleString()}円`,
    '{{日給}}': `${data.job.wage.toLocaleString()}円`,
    '{{交通費}}': `${data.job.transportation_fee.toLocaleString()}円`,
    '{{業務内容}}': data.job.work_content ? data.job.work_content.map(c => `・${c}`).join('\n') : (data.job.overview || ''),
    '{{持ち物}}': data.job.belongings ? data.job.belongings.map(b => `・${b}`).join('\n') : '特になし',
    '{{喫煙対策}}': data.facility.smoking_measure || '屋内禁煙',
    '{{発行日}}': formatDate(new Date().toISOString()),
  };

  // テンプレート内の変数を置換
  let content = templateSettings.template_content;
  Object.entries(variables).forEach(([key, value]) => {
    // グローバル置換のために正規表現を使用
    content = content.replace(new RegExp(key, 'g'), value);
  });

  // テキストをHTMLに変換（改行を保持、アクセントカラー適用）
  const processedContent = content.split('\n').map(line => {
    const escapedLine = escapeHtml(line);
    // ■で始まる行をスタイリング
    if (escapedLine.trim().startsWith('■')) {
      return `<div class="section-header" style="color: ${templateSettings.accent_color}; border-bottom: 2px solid ${templateSettings.accent_color};">${escapedLine}</div>`;
    }
    return `<div>${escapedLine || '&nbsp;'}</div>`; // 空行も高さを持たせる
  }).join('');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #333;
      padding: 40px 50px;
    }

    .section-header {
      font-size: 12pt;
      font-weight: 700;
      margin-top: 20px;
      margin-bottom: 10px;
      padding-bottom: 4px;
    }

    /* 最初の要素がsection-headerの場合、margin-topを削除 */
    .section-header:first-child {
      margin-top: 0;
    }
  </style>
</head>
<body>
  ${processedContent}
</body>
</html>
`;
}

/**
 * 労働条件通知書のPDFを生成する（Puppeteer使用、テンプレート対応版）
 */
export async function generateLaborDocumentPdf(data: LaborDocumentData, customTemplate?: TemplateSettings): Promise<Buffer> {
  // テンプレート設定を取得（引数で指定がなければDBから取得）
  const template = customTemplate || await getTemplateSettings();
  const html = generateHtml(data, template);

  // Puppeteerでブラウザを起動
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // HTMLをセット
    await page.setContent(html, {
      waitUntil: 'networkidle0', // Webフォントの読み込みを待つ
    });

    // PDFを生成（A4サイズ）
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * 労働条件通知書のファイル名を生成
 */
export function generateLaborDocumentFilename(
  workerName: string,
  workDate: string,
  applicationId: number
): string {
  const date = new Date(workDate);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  // ファイル名に使用できない文字を除去
  const safeName = workerName.replace(/[/\\?%*:|"<>]/g, '_');
  return `労働条件通知書_${safeName}_${dateStr}_${applicationId}.pdf`;
}
