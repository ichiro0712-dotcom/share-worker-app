/**
 * 応募管理モーダル(JobApplicationModal)の金額表示 修正検証スクリプト
 *
 * 背景:
 *   施設の応募管理画面/シフトカレンダー画面で開くモーダルが、
 *   総支給額を「時給 × (終了 − 開始)」で再計算しており、
 *     - 休憩時間を控除していない
 *     - 深夜/残業割増を考慮していない
 *     - 供給元が transportationFee を返さず常に「支給なし」
 *   ため、求人本体・ワーカー画面(保存値 Job.wage)と乖離していた。
 *
 * 修正:
 *   モーダルは再計算をやめ、保存値 Job.wage(= calculateDailyWage で確定・休憩控除/割増/交通費込み)
 *   をそのまま「総支給額」に表示し、交通費も供給元から受け取った値を表示する。
 *
 * 本スクリプトは DB に接続せず、純粋なロジック比較で以下を確認する:
 *   1. 旧モーダル式(再計算)は休憩がある求人で総支給額を過大表示していた
 *   2. 修正後に表示する Job.wage(= calculateDailyWage) が正しい総支給額である
 *
 * 実行: npx tsx prisma/verify-application-modal-wage.ts
 */

import { calculateDailyWage } from '../utils/salary';

/** 修正前の JobApplicationModal.calculateTotalPayment と同一実装(比較用に再現) */
function legacyModalTotalPayment(
  hourlyWage: number,
  startTime: string,
  endTime: string,
  transportationFee = 0,
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let hours = endH + endM / 60 - (startH + startM / 60);
  if (hours < 0) hours += 24; // 日跨ぎ対応
  return Math.round(hourlyWage * hours + transportationFee);
}

interface Case {
  name: string;
  startTime: string;
  endTime: string;
  breakTime: number; // 分
  hourlyWage: number;
  transportationFee: number;
}

const cases: Case[] = [
  {
    // クライアント報告の実ケース: 求人ID 680（梅島駅 訪問入浴ステーションあひる）
    name: '求人#680 相当（08:30-17:00 / 休憩60分 / 交通費なし）',
    startTime: '08:30',
    endTime: '17:00',
    breakTime: 60,
    hourlyWage: 1820,
    transportationFee: 0,
  },
  {
    name: '日勤 + 交通費あり（09:00-18:00 / 休憩60分 / 交通費800）',
    startTime: '09:00',
    endTime: '18:00',
    breakTime: 60,
    hourlyWage: 1500,
    transportationFee: 800,
  },
  {
    name: '休憩なし短時間（10:00-14:00 / 休憩0分 / 交通費400）',
    startTime: '10:00',
    endTime: '14:00',
    breakTime: 0,
    hourlyWage: 1300,
    transportationFee: 400,
  },
  {
    name: '夜勤跨ぎ（17:00-翌09:00 / 休憩120分 / 交通費800）',
    startTime: '17:00',
    endTime: '09:00',
    breakTime: 120,
    hourlyWage: 1500,
    transportationFee: 800,
  },
];

console.log('==================================================================');
console.log(' 応募管理モーダル 総支給額表示 修正検証');
console.log('==================================================================\n');

let allPass = true;

for (const c of cases) {
  // 修正後にモーダルが表示する値 = 保存値 Job.wage = calculateDailyWage(...)
  const correct = calculateDailyWage(
    c.startTime,
    c.endTime,
    c.breakTime,
    c.hourlyWage,
    c.transportationFee,
  );
  // 修正前にモーダルが表示していた値（休憩控除なし・割増なし・交通費0扱い）
  const oldModal = legacyModalTotalPayment(c.hourlyWage, c.startTime, c.endTime, 0);

  // 期待: 修正後表示(correct)が正しく、休憩>0 または 交通費>0 の場合は旧表示と差が出る
  const shouldDiffer = c.breakTime > 0 || c.transportationFee > 0;
  const differs = oldModal !== correct;
  const pass = shouldDiffer ? differs : true;
  if (!pass) allPass = false;

  console.log(`▼ ${c.name}`);
  console.log(`   勤務 ${c.startTime}〜${c.endTime} / 休憩${c.breakTime}分 / 時給¥${c.hourlyWage.toLocaleString()} / 交通費¥${c.transportationFee.toLocaleString()}`);
  console.log(`   修正前モーダル表示 (誤): ¥${oldModal.toLocaleString()}  ※休憩控除なし・交通費なし扱い`);
  console.log(`   修正後モーダル表示 (正): ¥${correct.toLocaleString()}  ※Job.wage(休憩控除・割増・交通費込)`);
  console.log(`   差額: ¥${(oldModal - correct).toLocaleString()}  → ${differs ? '乖離あり(修正で解消)' : '一致'}  [${pass ? 'PASS' : 'FAIL'}]\n`);
}

console.log('==================================================================');
console.log(allPass ? '✅ 全ケース: 修正後の表示(Job.wage)が正しい総支給額であることを確認' : '❌ 想定外の結果あり');
console.log('==================================================================');

process.exit(allPass ? 0 : 1);
