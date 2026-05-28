export type BankAccountStatus = 'verified' | 'cooldown' | 'blocked' | 'unregistered';

export type BankAccountSummary = {
  bankName: string;
  branchName: string;
  last4: string;
  status: BankAccountStatus;
};

export type WorkerHistoryStatus = 'completed' | 'charged' | 'accepted' | 'processing' | 'failed';

export type WorkerHistoryItem = {
  id: string;
  date: string;
  title: string;
  status: WorkerHistoryStatus;
  amount: number;
  note: string;
};

export type AdminErrorStatus = 'new' | 'in_progress' | 'waiting_worker' | 'resolved';

export type HibaraiErrorItem = {
  id: string;
  workerId: string;
  workerName: string;
  errorType: string;
  amount: number;
  occurredAt: string;
  status: AdminErrorStatus;
  supportCode: string;
};

export type WithdrawalStatus = 'completed' | 'accepted' | 'processing' | 'failed';

export type AdminWithdrawalItem = {
  id: string;
  workerId: string;
  workerName: string;
  amount: number;
  fee: number;
  status: WithdrawalStatus;
  requestedAt: string;
  completedAt: string;
  bankName: string;
};

export type AuditLogItem = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  ipAddress: string;
  result: '成功' | '失敗' | '承認待ち' | '警告';
  type: 'withdrawal' | 'account' | 'policy' | 'emergency' | 'auth';
};

export const workerBalance = {
  availableAmount: 12480,
  reviewUnlockAmount: 8640,
  fee: 143,
  scheduledPaymentAmount: 3120,
  // ダミーの支払日は案件ごとの既存報酬支払日を表す。全社統一日ではない。
  scheduledPaymentDate: '6月25日（水）',
  deadlineText: '5/31 23:59まで受け取りできます',
  account: {
    bankName: 'みずほ銀行',
    branchName: '渋谷支店',
    last4: '1234',
    status: 'verified',
  } satisfies BankAccountSummary,
};

export const workerHistory: WorkerHistoryItem[] = [
  {
    id: 'wd_001',
    date: '5月27日（水）',
    title: '振込完了',
    status: 'completed',
    amount: -10000,
    note: 'みずほ銀行 ****1234 へ振り込みました',
  },
  {
    id: 'ch_001',
    date: '5月26日（火）',
    title: 'チャージ',
    status: 'charged',
    amount: 8640,
    note: 'さくらケアセンター 勤務分',
  },
  {
    id: 'wd_002',
    date: '5月25日（月）',
    title: '確認が必要',
    status: 'failed',
    amount: -6000,
    note: '受取口座を確認してください',
  },
  {
    id: 'wd_003',
    date: '5月24日（日）',
    title: '銀行確認中',
    status: 'processing',
    amount: -4800,
    note: '銀行で確認でき次第、振り込みます',
  },
  {
    id: 'wd_004',
    date: '5月22日（金）',
    title: '申請受付',
    status: 'accepted',
    amount: -3500,
    note: '受け取り申請できました',
  },
  {
    id: 'ch_002',
    date: '5月21日（木）',
    title: 'チャージ',
    status: 'charged',
    amount: 7200,
    note: 'ひまわり訪問看護 勤務分',
  },
  {
    id: 'wd_005',
    date: '5月19日（火）',
    title: '振込完了',
    status: 'completed',
    amount: -8500,
    note: 'みずほ銀行 ****1234 へ振り込みました',
  },
  {
    id: 'ch_003',
    date: '5月18日（月）',
    title: 'チャージ',
    status: 'charged',
    amount: 9400,
    note: 'あおば老人ホーム 勤務分',
  },
  {
    id: 'wd_006',
    date: '5月15日（金）',
    title: '振込完了',
    status: 'completed',
    amount: -5000,
    note: 'みずほ銀行 ****1234 へ振り込みました',
  },
  {
    id: 'ch_004',
    date: '5月14日（木）',
    title: 'チャージ',
    status: 'charged',
    amount: 6800,
    note: 'つばきデイサービス 勤務分',
  },
  {
    id: 'wd_007',
    date: '5月12日（火）',
    title: '振込完了',
    status: 'completed',
    amount: -12000,
    note: 'みずほ銀行 ****1234 へ振り込みました',
  },
];

export const balanceBreakdownRows = [
  { label: 'チャージ済み', amount: 38400, note: 'レビュー後に受け取れるようになった勤務分' },
  { label: '出金済み', amount: -24500, note: 'すでに受け取った金額' },
  { label: '手数料', amount: -1420, note: '受け取り時に引かれた手数料' },
  { label: '支払日に入る金額', amount: 3120, note: '一部は案件ごとの既存の支払日に入ります' },
];

export const hibaraiFaqItems = [
  {
    question: 'いつ受け取れますか？',
    answer: '勤務完了とレビュー確認後、今すぐ受け取れる金額として表示されます。銀行で確認でき次第、登録済みの受取口座へ振り込みます。',
  },
  {
    question: 'いくらから受け取れますか？',
    answer: '1円から受け取れます。画面には手数料を引いた振込予定額を表示します。',
  },
  {
    question: 'レビューすると何が変わりますか？',
    answer: '勤務レビューが完了すると、その勤務分の金額が受け取り対象に追加されます。',
  },
  {
    question: '月末を過ぎた金額はどうなりますか？',
    answer: '5/31 23:59を過ぎた分は、支払日に入る金額として各案件の既存の支払日に振り込まれます。',
  },
  {
    question: '口座を変更した直後に受け取れますか？',
    answer: '安全確認のため、変更後はしばらく確認中になる場合があります。画面に表示される案内に沿ってください。',
  },
];

export const glossaryItems = [
  { term: '今すぐ受け取れる金額', description: '今日、受け取る操作ができる上限額です。' },
  { term: '支払日に入る金額', description: '日払いで受け取らず、各案件の既存の支払日に振り込まれる予定の金額です。' },
  { term: '受取口座', description: '日払いの振込先として登録した銀行口座です。' },
];

export const adminSummary = {
  todayRequests: 42,
  errorCount: 3,
  stoppedWorkers: 0,
  totalWithdrawn: 1384200,
};

export const adminErrors: HibaraiErrorItem[] = [
  { id: 'err_001', workerId: 'wk_1024', workerName: '高橋 美咲', errorType: '口座名義不一致', amount: 12000, occurredAt: '2026/05/27 10:12', status: 'new', supportCode: 'HB-1024' },
  { id: 'err_002', workerId: 'wk_1008', workerName: '佐藤 由紀', errorType: '口座番号の桁ちがい', amount: 8000, occurredAt: '2026/05/27 09:44', status: 'in_progress', supportCode: 'HB-1008' },
  { id: 'err_003', workerId: 'wk_0911', workerName: '鈴木 真理', errorType: '銀行メンテナンス', amount: 6400, occurredAt: '2026/05/27 08:36', status: 'waiting_worker', supportCode: 'HB-0911' },
  { id: 'err_004', workerId: 'wk_0833', workerName: '田中 恵', errorType: '支店コード不一致', amount: 9200, occurredAt: '2026/05/26 18:21', status: 'new', supportCode: 'HB-0833' },
  { id: 'err_005', workerId: 'wk_0772', workerName: '伊藤 直子', errorType: '口座停止中', amount: 15000, occurredAt: '2026/05/26 16:05', status: 'in_progress', supportCode: 'HB-0772' },
  { id: 'err_006', workerId: 'wk_0661', workerName: '山本 香織', errorType: '名義カナ不一致', amount: 4200, occurredAt: '2026/05/26 14:50', status: 'resolved', supportCode: 'HB-0661' },
  { id: 'err_007', workerId: 'wk_0588', workerName: '中村 明子', errorType: '銀行受付時間外', amount: 7800, occurredAt: '2026/05/26 13:12', status: 'waiting_worker', supportCode: 'HB-0588' },
  { id: 'err_008', workerId: 'wk_0520', workerName: '小林 優子', errorType: '口座番号の桁ちがい', amount: 6600, occurredAt: '2026/05/25 19:28', status: 'resolved', supportCode: 'HB-0520' },
  { id: 'err_009', workerId: 'wk_0484', workerName: '加藤 里奈', errorType: '支店コード不一致', amount: 13200, occurredAt: '2026/05/25 17:41', status: 'new', supportCode: 'HB-0484' },
  { id: 'err_010', workerId: 'wk_0417', workerName: '吉田 千春', errorType: '名義カナ不一致', amount: 5400, occurredAt: '2026/05/25 15:20', status: 'in_progress', supportCode: 'HB-0417' },
  { id: 'err_011', workerId: 'wk_0388', workerName: '松本 陽子', errorType: '口座停止中', amount: 11800, occurredAt: '2026/05/24 12:42', status: 'waiting_worker', supportCode: 'HB-0388' },
  { id: 'err_012', workerId: 'wk_0309', workerName: '井上 彩', errorType: '銀行メンテナンス', amount: 7300, occurredAt: '2026/05/24 10:30', status: 'resolved', supportCode: 'HB-0309' },
  { id: 'err_013', workerId: 'wk_0256', workerName: '木村 典子', errorType: '口座名義不一致', amount: 9600, occurredAt: '2026/05/23 17:02', status: 'new', supportCode: 'HB-0256' },
  { id: 'err_014', workerId: 'wk_0199', workerName: '林 佳代', errorType: '口座番号の桁ちがい', amount: 5100, occurredAt: '2026/05/23 14:16', status: 'resolved', supportCode: 'HB-0199' },
  { id: 'err_015', workerId: 'wk_0112', workerName: '清水 美穂', errorType: '支店コード不一致', amount: 8800, occurredAt: '2026/05/22 11:05', status: 'in_progress', supportCode: 'HB-0112' },
];

export const adminWithdrawals: AdminWithdrawalItem[] = [
  { id: 'wd_a001', workerId: 'wk_1090', workerName: '渡辺 佳奈', amount: 12480, fee: 143, status: 'completed', requestedAt: '2026/05/27 10:22', completedAt: '2026/05/27 10:31', bankName: 'みずほ銀行' },
  { id: 'wd_a002', workerId: 'wk_1042', workerName: '高橋 美咲', amount: 12000, fee: 143, status: 'failed', requestedAt: '2026/05/27 10:12', completedAt: '-', bankName: '三菱UFJ銀行' },
  { id: 'wd_a003', workerId: 'wk_1008', workerName: '佐藤 由紀', amount: 8000, fee: 143, status: 'processing', requestedAt: '2026/05/27 09:44', completedAt: '-', bankName: 'りそな銀行' },
  { id: 'wd_a004', workerId: 'wk_0977', workerName: '斎藤 久美', amount: 6200, fee: 143, status: 'accepted', requestedAt: '2026/05/27 09:30', completedAt: '-', bankName: 'ゆうちょ銀行' },
  { id: 'wd_a005', workerId: 'wk_0911', workerName: '鈴木 真理', amount: 6400, fee: 143, status: 'failed', requestedAt: '2026/05/27 08:36', completedAt: '-', bankName: 'みずほ銀行' },
  { id: 'wd_a006', workerId: 'wk_0833', workerName: '田中 恵', amount: 9200, fee: 143, status: 'completed', requestedAt: '2026/05/26 18:21', completedAt: '2026/05/26 18:36', bankName: '三井住友銀行' },
  { id: 'wd_a007', workerId: 'wk_0772', workerName: '伊藤 直子', amount: 15000, fee: 143, status: 'failed', requestedAt: '2026/05/26 16:05', completedAt: '-', bankName: '楽天銀行' },
  { id: 'wd_a008', workerId: 'wk_0661', workerName: '山本 香織', amount: 4200, fee: 143, status: 'completed', requestedAt: '2026/05/26 14:50', completedAt: '2026/05/26 15:02', bankName: 'PayPay銀行' },
  { id: 'wd_a009', workerId: 'wk_0588', workerName: '中村 明子', amount: 7800, fee: 143, status: 'processing', requestedAt: '2026/05/26 13:12', completedAt: '-', bankName: '住信SBIネット銀行' },
  { id: 'wd_a010', workerId: 'wk_0520', workerName: '小林 優子', amount: 6600, fee: 143, status: 'completed', requestedAt: '2026/05/25 19:28', completedAt: '2026/05/25 19:40', bankName: 'みずほ銀行' },
];

export const workerSettings = {
  workerId: 'wk_1024',
  name: '高橋 美咲',
  phone: '090-1234-5678',
  currentRate: 90,
  currentLimit: 50000,
  status: '通常',
  lastChangedBy: 'system-admin@example.com',
  history: [
    { date: '2026/05/20 14:12', actor: '山田 管理者', action: '通常90%へ変更', reason: '本人確認完了のため' },
    { date: '2026/05/12 09:35', actor: '佐々木 管理者', action: '上限50,000円へ変更', reason: '勤務実績に合わせて調整' },
    { date: '2026/05/01 11:02', actor: 'system', action: '初期設定', reason: '登録時の標準設定' },
  ],
};

export const stopHistory = [
  { date: '2026/05/21 01:12', actor: '山田 管理者', action: '停止', reason: '銀行API応答遅延' },
  { date: '2026/05/21 08:32', actor: '佐々木 管理者 / 田村 管理者', action: '再開', reason: '原因解消、二者確認済み' },
  { date: '2026/05/10 23:45', actor: 'system', action: '自動停止', reason: 'エラー率しきい値超過' },
];

export const auditLogs: AuditLogItem[] = Array.from({ length: 20 }, (_, index) => {
  const actions = [
    ['withdrawal', '出金ステータス更新', 'wd_a001', '成功'],
    ['account', '受取口座の確認', 'wk_1024', '成功'],
    ['policy', 'ワーカー別上限変更', 'wk_1008', '承認待ち'],
    ['emergency', '緊急停止スイッチ操作', 'global', '成功'],
    ['auth', '管理者ログイン', 'system-admin', '成功'],
  ] as const;
  const item = actions[index % actions.length];

  return {
    id: `audit_${String(index + 1).padStart(3, '0')}`,
    timestamp: `2026/05/${String(27 - Math.floor(index / 4)).padStart(2, '0')} ${String(10 + (index % 8)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
    actor: index % 4 === 0 ? 'system' : ['山田 管理者', '佐々木 管理者', '田村 管理者'][index % 3],
    action: item[1],
    target: item[2],
    ipAddress: `203.0.113.${20 + index}`,
    result: item[3],
    type: item[0],
  };
});
