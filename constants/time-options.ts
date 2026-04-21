/**
 * 共通時刻セレクト option（1 時間刻み 00:00 〜 23:00）
 *
 * 登録フォーム（/register/worker）とプロフィール編集画面（/mypage/profile）の
 * 「希望開始/終了時刻」で同じ値セットを参照することで、文字列不一致による
 * 「選択してください」問題の再発を防ぐ。
 */
export const HOUR_TIME_OPTIONS: string[] = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});
