'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

const API_ENDPOINT = '/api/lp-tracking';
const LP_ID = '0';
const STORAGE_EXPIRY_DAYS = 7;
const MAX_DWELL_TIME_SECONDS = 600; // 10分でキャップ

interface PublicJobsTrackerProps {
  pageType: 'list' | 'detail';
  jobId?: string;
}

function getSessionId(): string {
  // LP0専用のセッションIDキーを使用（既存LPのtracking.jsとの競合を防ぐ）
  const storageKey = `lp_session_id_${LP_ID}`;
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

function getCampaignCode(): string | null {
  try {
    const data = localStorage.getItem('lp_tracking_data');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.expiry && Date.now() < parsed.expiry) {
        return parsed.campaignCode || null;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function extractGenrePrefix(code: string): string | null {
  const match = code.match(/^([A-Z]{3})-/);
  return match ? match[1] : null;
}

function storeCampaignCode(code: string) {
  const expiry = Date.now() + STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const genrePrefix = extractGenrePrefix(code);

  const data = {
    lpId: LP_ID,
    campaignCode: code,
    genrePrefix,
    firstVisit: new Date().toISOString(),
    expiry,
  };

  localStorage.setItem('lp_tracking_data', JSON.stringify(data));
  localStorage.setItem('lp_campaign_code', code);
  if (genrePrefix) {
    localStorage.setItem('lp_genre_prefix', genrePrefix);
  }
  localStorage.setItem('lp_id', LP_ID);
  localStorage.setItem('lp_first_visit', new Date().toISOString());
}

function sendBeacon(data: Record<string, unknown>) {
  const sessionId = getSessionId();
  const campaignCode = getCampaignCode();

  const payload = {
    ...data,
    lpId: LP_ID,
    campaignCode,
    sessionId,
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(API_ENDPOINT, blob);
  } else {
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

export default function PublicJobsTracker({ pageType, jobId }: PublicJobsTrackerProps) {
  const searchParams = useSearchParams();
  const startTimeRef = useRef(Date.now());
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;

    // キャンペーンコード取得・保存
    const cParam = searchParams.get('c');
    if (cParam) {
      // 既存データの有効期限チェック
      const existing = localStorage.getItem('lp_tracking_data');
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (!parsed.expiry || Date.now() > parsed.expiry) {
            storeCampaignCode(cParam);
          }
          // 有効期限内なら上書きしない（初回訪問のみ保存）
        } catch {
          storeCampaignCode(cParam);
        }
      } else {
        storeCampaignCode(cParam);
      }
    }

    // ページビュー送信
    if (pageType === 'list') {
      sendBeacon({ type: 'pageview' });
    } else if (pageType === 'detail' && jobId) {
      sendBeacon({ type: 'job_pageview', jobId: parseInt(jobId, 10) });
    }
  }, [pageType, jobId, searchParams]);

  // ページ離脱時のエンゲージメントサマリー送信
  useEffect(() => {
    function sendSummary() {
      const rawDwellTime = Math.round((Date.now() - startTimeRef.current) / 1000);
      const totalDwellTime = Math.min(rawDwellTime, MAX_DWELL_TIME_SECONDS);

      sendBeacon({
        type: 'engagement_summary',
        maxScrollDepth: 0,
        totalDwellTime,
        engagementLevel: totalDwellTime >= 10 ? 2 : totalDwellTime >= 5 ? 1 : 0,
        ctaClicked: false,
      });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendSummary();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', sendSummary);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', sendSummary);
    };
  }, []);

  return null;
}
