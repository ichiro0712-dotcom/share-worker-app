-- ============================================================
-- 修正SQL: 勤務回数カウントの過去データ修正（JST対応版）
--
-- 注意: Supabase(PostgreSQL)はUTCで動作するため、
--       JSTの「今日」を正しく判定するにはタイムゾーン変換が必要。
--       work_dateはJST深夜0時をUTCで保存している（例: JST 3/12 00:00 = UTC 3/11 15:00）
-- ============================================================

-- ============================================================
-- ■ STEP 0: 前回のSQL実行で誤更新されたレコードの復旧
--   UTC/JSTのズレにより、未来の勤務予定が誤ってCOMPLETED_PENDINGにされた分を戻す
--   ※ 対象: 勤務日がJST基準で今日以降 かつ COMPLETED_PENDING のApplication
-- ============================================================

-- 確認用SELECT（まずこちらで対象を確認）
SELECT
  app.id AS application_id,
  app.user_id AS worker_id,
  u.name AS worker_name,
  app.status AS current_status,
  jwd.work_date,
  jwd.work_date AT TIME ZONE 'Asia/Tokyo' AS work_date_jst,
  j.title AS job_title,
  f.facility_name
FROM applications app
JOIN job_work_dates jwd ON jwd.id = app.work_date_id
JOIN jobs j ON j.id = jwd.job_id
JOIN facilities f ON f.id = j.facility_id
JOIN users u ON u.id = app.user_id
WHERE app.status = 'COMPLETED_PENDING'
  AND jwd.work_date >= (NOW() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo'
ORDER BY jwd.work_date;

-- 復旧UPDATE（確認後に実行）
-- ※ 勤務開始時刻が過ぎていればWORKING、まだならSCHEDULEDに戻す
-- ※ 安全のため一律SCHEDULEDに戻す（status-updaterが次回アクセス時に自動でWORKINGに更新する）
UPDATE applications
SET status = 'SCHEDULED',
    updated_at = NOW()
WHERE status = 'COMPLETED_PENDING'
  AND work_date_id IN (
    SELECT jwd.id
    FROM job_work_dates jwd
    WHERE jwd.work_date >= (NOW() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo'
  );

-- ============================================================
-- ■ STEP 1: 過去データの確認（勤務日がJST基準で昨日以前 かつ WORKINGのまま）
-- ============================================================
SELECT
  app.id AS application_id,
  app.user_id AS worker_id,
  u.name AS worker_name,
  u.email AS worker_email,
  app.status AS current_status,
  jwd.work_date,
  jwd.work_date AT TIME ZONE 'Asia/Tokyo' AS work_date_jst,
  j.title AS job_title,
  f.facility_name,
  att.id AS attendance_id,
  att.check_out_type
FROM applications app
JOIN job_work_dates jwd ON jwd.id = app.work_date_id
JOIN jobs j ON j.id = jwd.job_id
JOIN facilities f ON f.id = j.facility_id
JOIN users u ON u.id = app.user_id
LEFT JOIN attendances att ON att.application_id = app.id
WHERE app.status = 'WORKING'
  AND jwd.work_date < (NOW() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo'
ORDER BY jwd.work_date DESC, f.facility_name;

-- ============================================================
-- ■ STEP 2: 過去データの修正（STEP 1で確認後に実行）
-- ============================================================
UPDATE applications
SET status = 'COMPLETED_PENDING',
    updated_at = NOW()
WHERE status = 'WORKING'
  AND work_date_id IN (
    SELECT jwd.id
    FROM job_work_dates jwd
    WHERE jwd.work_date < (NOW() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo'
  );
