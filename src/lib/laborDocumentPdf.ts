import puppeteer from 'puppeteer';
import { DEFAULT_DISMISSAL_REASONS } from '@/constants/employment';

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
    address: string;
    overview: string | null;
    work_content: string[];
    belongings: string[];
  };
  facility: {
    id: number;
    corporation_name: string;
    facility_name: string;
    address: string;
    prefecture: string | null;
    city: string | null;
    address_detail: string | null;
    smoking_measure: string | null;
  };
  dismissalReasons: string | null;
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
 * 労働条件通知書のHTMLを生成
 */
function generateHtml(data: LaborDocumentData): string {
  const facilityAddress = `${data.facility.prefecture || ''}${data.facility.city || ''}${data.facility.address_detail || data.facility.address}`;
  const dismissalText = data.dismissalReasons || DEFAULT_DISMISSAL_REASONS;

  const workContentHtml = data.job.work_content && data.job.work_content.length > 0
    ? data.job.work_content.map(c => `<li>${escapeHtml(c)}</li>`).join('')
    : `<li>${escapeHtml(data.job.overview || '詳細は施設からの指示に従ってください')}</li>`;

  const belongingsHtml = data.job.belongings && data.job.belongings.length > 0
    ? `
      <div class="section">
        <div class="section-header"><span class="bar"></span>作業用品その他</div>
        <ul class="bullet-list">
          ${data.job.belongings.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      </div>
    `
    : '';

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
      color: #000;
      padding: 40px 50px;
    }

    .title {
      text-align: center;
      font-size: 20pt;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .issue-date {
      text-align: center;
      font-size: 10pt;
      color: #666;
      margin-bottom: 30px;
    }

    .section {
      margin-bottom: 15px;
    }

    .section-header {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bar {
      display: inline-block;
      width: 4px;
      height: 14px;
      background-color: #3B82F6;
    }

    .key-value {
      display: flex;
      margin-bottom: 4px;
      padding-left: 12px;
    }

    .key {
      width: 120px;
      color: #666;
      flex-shrink: 0;
    }

    .value {
      flex: 1;
    }

    .bullet-list {
      list-style: none;
      padding-left: 12px;
    }

    .bullet-list li::before {
      content: "・";
    }

    .paragraph {
      padding-left: 12px;
      font-size: 9pt;
      margin-bottom: 4px;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }

    .pledges {
      padding-left: 12px;
      font-size: 9pt;
    }

    .pledges li {
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <h1 class="title">労働条件通知書</h1>
  <p class="issue-date">発行日: ${formatDate(new Date().toISOString())}</p>

  <div class="section">
    <div class="section-header"><span class="bar"></span>使用者情報</div>
    <div class="key-value"><span class="key">使用者法人名</span><span class="value">${escapeHtml(data.facility.corporation_name)}</span></div>
    <div class="key-value"><span class="key">法人所在地</span><span class="value">${escapeHtml(facilityAddress)}</span></div>
    <div class="key-value"><span class="key">事業所名称</span><span class="value">${escapeHtml(data.facility.facility_name)}</span></div>
    <div class="key-value"><span class="key">就業場所</span><span class="value">${escapeHtml(data.job.address)}</span></div>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>労働者情報</div>
    <div class="key-value"><span class="key">労働者氏名</span><span class="value">${escapeHtml(data.user.name)} 殿</span></div>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>契約情報</div>
    <div class="key-value"><span class="key">就労日</span><span class="value">${formatDate(data.application.work_date)}</span></div>
    <div class="key-value"><span class="key">労働契約の期間</span><span class="value">1日（単発契約）</span></div>
    <div class="key-value"><span class="key">契約更新の有無</span><span class="value">有（ただし条件あり、都度契約）</span></div>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>業務内容</div>
    <ul class="bullet-list">
      ${workContentHtml}
    </ul>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>勤務時間</div>
    <div class="key-value"><span class="key">始業時刻</span><span class="value">${formatTime(data.job.start_time)}</span></div>
    <div class="key-value"><span class="key">終業時刻</span><span class="value">${formatTime(data.job.end_time)}</span></div>
    <div class="key-value"><span class="key">休憩時間</span><span class="value">${data.job.break_time}分</span></div>
    <div class="key-value"><span class="key">所定時間外労働</span><span class="value">原則なし</span></div>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>賃金</div>
    <div class="key-value"><span class="key">基本賃金</span><span class="value">時給 ${data.job.hourly_wage.toLocaleString()}円</span></div>
    <div class="key-value"><span class="key">日給合計</span><span class="value">${data.job.wage.toLocaleString()}円</span></div>
    <div class="key-value"><span class="key">諸手当（交通費）</span><span class="value">${data.job.transportation_fee.toLocaleString()}円</span></div>
    <div class="key-value"><span class="key">時間外労働割増</span><span class="value">法定通り（25%増）</span></div>
    <div class="key-value"><span class="key">賃金支払日</span><span class="value">翌月末日払い</span></div>
    <div class="key-value"><span class="key">支払方法</span><span class="value">銀行振込</span></div>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>社会保険等</div>
    <p class="paragraph">単発契約のため、社会保険・雇用保険・労災保険の適用については、法定の要件に基づき判断されます。</p>
  </div>

  ${belongingsHtml}

  <div class="section">
    <div class="section-header"><span class="bar"></span>受動喫煙防止措置</div>
    <p class="paragraph">${escapeHtml(data.facility.smoking_measure || '屋内禁煙（喫煙専用室あり）')}</p>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>解雇の事由その他関連する事項</div>
    <p class="paragraph">${escapeHtml(dismissalText).replace(/\n/g, '<br>')}</p>
  </div>

  <div class="section">
    <div class="section-header"><span class="bar"></span>誓約事項</div>
    <ol class="pledges">
      <li>業務上知り得た秘密は、在職中のみならず退職後においても第三者に漏洩いたしません。</li>
      <li>利用者様の個人情報は適切に取り扱い、プライバシーを尊重いたします。</li>
      <li>施設の規則・指示に従い、誠実に業務を遂行いたします。</li>
      <li>遅刻・早退・欠勤の際は、速やかに連絡いたします。</li>
    </ol>
  </div>

  <div class="footer">
    <p>本書は労働基準法第15条に基づき、労働条件を明示するものです。</p>
    <p>発行: S WORKS</p>
  </div>
</body>
</html>
`;
}

/**
 * 労働条件通知書のPDFを生成する（Puppeteer使用、軽量版）
 */
export async function generateLaborDocumentPdf(data: LaborDocumentData): Promise<Buffer> {
  const html = generateHtml(data);

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
