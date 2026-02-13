// LPトラッキングスクリプト v2
// スクロール、滞在時間、セクション別計測、エンゲージメント分析対応
(function() {
  'use strict';

  // ========== 設定 ==========
  const CONFIG = {
    SCROLL_THRESHOLDS: [25, 50, 75, 90],
    DWELL_THRESHOLDS: [5, 10],
    STORAGE_EXPIRY_DAYS: 7,
    API_ENDPOINT: '/api/lp-tracking',
    SECTION_TRACK_INTERVAL: 1000, // セクション滞在計測間隔（ミリ秒）
    MAX_DWELL_TIME_SECONDS: 300, // 滞在時間の上限（5分）- 異常値対策
  };

  // ========== 状態管理 ==========
  const state = {
    sessionId: null,
    lpId: null,
    campaignCode: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    startTime: Date.now(),
    scrollReached: { 25: false, 50: false, 75: false, 90: false },
    dwellReached: { 5: false, 10: false },
    maxScrollDepth: 0,
    ctaClicked: false,
    sectionDwellTimes: {}, // { sectionId: seconds }
    currentVisibleSection: null,
    sectionStartTime: null,
  };

  // ========== ユーティリティ ==========

  // セッションIDを生成または取得
  function getSessionId() {
    let sessionId = sessionStorage.getItem('lp_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      sessionStorage.setItem('lp_session_id', sessionId);
    }
    return sessionId;
  }

  // URLからパラメータを取得（c優先、UTMフォールバック）
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/\/lp\/(\d+)/);

    // LP番号: メタタグ優先（配信APIが埋め込むDB上のlp_number）、なければURLパスから
    const metaLpNumber = document.querySelector('meta[name="lp-number"]');
    const lpId = metaLpNumber ? metaLpNumber.getAttribute('content') : (pathMatch ? pathMatch[1] : null);

    const cParam = params.get('c');
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    // キャンペーンコード決定: c優先、UTMフォールバック
    let campaignCode = cParam;
    if (!campaignCode && utmSource && utmCampaign) {
      campaignCode = utmSource + '_' + utmCampaign;
    }

    return {
      lpId,
      campaignCode,
      utmSource,
      utmMedium,
      utmCampaign,
    };
  }

  // キャンペーンコードからジャンルプレフィックスを抽出（AAA-XXXXXX形式）
  function extractGenrePrefix(code) {
    if (!code) return null;
    const match = code.match(/^([A-Z]{3})-/);
    return match ? match[1] : null;
  }

  // localStorage有効期限チェック
  function isStorageExpired() {
    const data = localStorage.getItem('lp_tracking_data');
    if (!data) return true;

    try {
      const parsed = JSON.parse(data);
      if (!parsed.expiry) return true;
      return Date.now() > parsed.expiry;
    } catch (e) {
      return true;
    }
  }

  // 期限切れデータをクリア
  function clearExpiredStorage() {
    localStorage.removeItem('lp_tracking_data');
    localStorage.removeItem('lp_campaign_code');
    localStorage.removeItem('lp_genre_prefix');
    localStorage.removeItem('lp_id');
    localStorage.removeItem('lp_utm_source');
    localStorage.removeItem('lp_first_visit');
  }

  // localStorage保存（7日間有効）
  function storeToLocalStorage(params) {
    if (!params.lpId) return;

    // 既存データの有効期限チェック
    const existing = localStorage.getItem('lp_tracking_data');
    if (existing) {
      // 期限切れならクリアして新規保存を許可
      if (isStorageExpired()) {
        clearExpiredStorage();
      } else {
        // 有効期限内の既存データがあれば保存しない（初回訪問のみ）
        return;
      }
    }

    const expiry = Date.now() + (CONFIG.STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const genrePrefix = extractGenrePrefix(params.campaignCode);

    const data = {
      lpId: params.lpId,
      campaignCode: params.campaignCode,
      genrePrefix: genrePrefix,
      utmSource: params.utmSource,
      utmMedium: params.utmMedium,
      utmCampaign: params.utmCampaign,
      firstVisit: new Date().toISOString(),
      expiry: expiry,
    };

    localStorage.setItem('lp_tracking_data', JSON.stringify(data));

    // 個別キーも保存（後方互換性）
    if (params.campaignCode) {
      localStorage.setItem('lp_campaign_code', params.campaignCode);
    }
    if (genrePrefix) {
      localStorage.setItem('lp_genre_prefix', genrePrefix);
    }
    if (params.lpId) {
      localStorage.setItem('lp_id', params.lpId);
    }
    if (params.utmSource) {
      localStorage.setItem('lp_utm_source', params.utmSource);
    }
    localStorage.setItem('lp_first_visit', new Date().toISOString());
  }

  // API送信（Beacon API使用）
  function sendToAPI(data) {
    const payload = {
      ...data,
      lpId: state.lpId,
      campaignCode: state.campaignCode,
      sessionId: state.sessionId,
    };

    const url = CONFIG.API_ENDPOINT;
    const body = JSON.stringify(payload);

    // Beacon APIはContent-Typeを設定できないため、Blobで明示的に指定
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  // dataLayer.push()（GTM連携）
  function pushToDataLayer(eventName, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      lp_id: state.lpId,
      campaign_code: state.campaignCode,
      utm_source: state.utmSource,
      utm_medium: state.utmMedium,
      utm_campaign: state.utmCampaign,
      ...data,
    });
  }

  // ========== トラッキング機能 ==========

  // ページビュー記録
  function trackPageView() {
    sendToAPI({ type: 'pageview' });
    pushToDataLayer('lp_pageview', {});
  }

  // スクロールトラッキング
  function initScrollTracking() {
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          checkScrollDepth();
          ticking = false;
        });
        ticking = true;
      }
    }

    function checkScrollDepth() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

      // 最大スクロール深度を更新
      if (scrollPercent > state.maxScrollDepth) {
        state.maxScrollDepth = scrollPercent;
      }

      // 閾値チェック
      CONFIG.SCROLL_THRESHOLDS.forEach(function(threshold) {
        if (scrollPercent >= threshold && !state.scrollReached[threshold]) {
          state.scrollReached[threshold] = true;
          const timeToReach = Math.round((Date.now() - state.startTime) / 1000);

          sendToAPI({
            type: 'scroll',
            scrollDepth: threshold,
            timeToReach: timeToReach,
          });

          pushToDataLayer('lp_scroll', {
            scroll_depth: threshold,
            time_to_reach: timeToReach,
          });
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // 滞在時間トラッキング
  function initDwellTracking() {
    CONFIG.DWELL_THRESHOLDS.forEach(function(seconds) {
      setTimeout(function() {
        if (!state.dwellReached[seconds]) {
          state.dwellReached[seconds] = true;

          sendToAPI({
            type: 'dwell',
            dwellSeconds: seconds,
          });

          pushToDataLayer('lp_dwell', {
            dwell_seconds: seconds,
          });

          // エンゲージメントレベルチェック
          checkEngagementLevel();
        }
      }, seconds * 1000);
    });
  }

  // セクション別滞在時間トラッキング
  function initSectionTracking() {
    const sections = document.querySelectorAll('[data-section-id]');
    if (sections.length === 0) return;

    // Intersection Observer でセクションの可視状態を監視
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        const sectionId = entry.target.getAttribute('data-section-id');
        const sectionName = entry.target.getAttribute('data-section-name') || sectionId;

        if (entry.isIntersecting) {
          // 新しいセクションに入った
          if (state.currentVisibleSection !== sectionId) {
            // 前のセクションの時間を記録
            if (state.currentVisibleSection && state.sectionStartTime) {
              const dwellTime = (Date.now() - state.sectionStartTime) / 1000;
              if (!state.sectionDwellTimes[state.currentVisibleSection]) {
                state.sectionDwellTimes[state.currentVisibleSection] = { time: 0, name: '' };
              }
              state.sectionDwellTimes[state.currentVisibleSection].time += dwellTime;
            }

            // 新しいセクション開始
            state.currentVisibleSection = sectionId;
            state.sectionStartTime = Date.now();
            if (!state.sectionDwellTimes[sectionId]) {
              state.sectionDwellTimes[sectionId] = { time: 0, name: sectionName };
            }
          }
        }
      });
    }, {
      threshold: 0.5, // 50%以上表示されたらカウント
    });

    sections.forEach(function(section) {
      observer.observe(section);
    });
  }

  // CTAクリックトラッキング
  function initClickTracking() {
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a, button');
      if (!target) return;

      // LINE登録ボタン判定
      const isLineCTA =
        target.classList.contains('btn-line-cta') ||
        target.classList.contains('btn-line-header') ||
        (target.textContent && target.textContent.includes('LINE'));

      if (isLineCTA) {
        state.ctaClicked = true;
        const buttonId = target.id || 'line_register';
        const buttonText = target.textContent ? target.textContent.trim().substring(0, 50) : '';

        sendToAPI({
          type: 'click',
          buttonId: buttonId,
          buttonText: buttonText,
        });

        pushToDataLayer('lp_cta_click', {
          button_id: buttonId,
          button_text: buttonText,
        });

        // LINE URLにトラッキングパラメータを追加
        if (target.href && target.href.includes('liff.line.me')) {
          const url = new URL(target.href);
          if (state.campaignCode) {
            url.searchParams.set('lp_campaign', state.campaignCode);
          }
          if (state.lpId) {
            url.searchParams.set('lp_id', state.lpId);
          }
          target.href = url.toString();
        }
      }
      // その他のCTAボタン（非LINE）
      else if (
        target.classList.contains('cta') ||
        target.classList.contains('btn') ||
        target.tagName === 'BUTTON'
      ) {
        const buttonId = target.id || target.className || 'button';
        const buttonText = target.textContent ? target.textContent.trim().substring(0, 50) : '';

        sendToAPI({
          type: 'click',
          buttonId: buttonId,
          buttonText: buttonText,
        });
      }
    });
  }

  // エンゲージメントレベル計算
  function calculateEngagementLevel() {
    const rawDwellTime = Math.round((Date.now() - state.startTime) / 1000);
    const dwellTime = Math.min(rawDwellTime, CONFIG.MAX_DWELL_TIME_SECONDS); // 5分でキャップ
    const scrollDepth = state.maxScrollDepth;

    // Level 5: 10秒以上滞在 かつ 90%スクロール
    if (dwellTime >= 10 && scrollDepth >= 90) return 5;
    // Level 4: 10秒以上滞在 かつ 75%スクロール
    if (dwellTime >= 10 && scrollDepth >= 75) return 4;
    // Level 3: 10秒以上滞在 かつ 50%スクロール
    if (dwellTime >= 10 && scrollDepth >= 50) return 3;
    // Level 2: 10秒以上滞在
    if (dwellTime >= 10) return 2;
    // Level 1: 5秒以上滞在
    if (dwellTime >= 5) return 1;
    // Level 0: 未達成
    return 0;
  }

  // エンゲージメントレベルのイベント発火チェック
  function checkEngagementLevel() {
    const level = calculateEngagementLevel();
    if (level >= 1) {
      const patterns = {
        1: '5秒以上滞在',
        2: '10秒以上滞在',
        3: '10秒以上滞在かつ50%到達',
        4: '10秒以上滞在かつ75%到達',
        5: '10秒以上滞在かつ90%到達',
      };

      pushToDataLayer('lp_engagement', {
        engagement_level: level,
        engagement_pattern: patterns[level],
      });
    }
  }

  // ページ離脱時のサマリー送信
  function initPageUnloadHandler() {
    function sendSummary() {
      // 現在のセクション滞在時間を確定
      if (state.currentVisibleSection && state.sectionStartTime) {
        const dwellTime = (Date.now() - state.sectionStartTime) / 1000;
        if (!state.sectionDwellTimes[state.currentVisibleSection]) {
          state.sectionDwellTimes[state.currentVisibleSection] = { time: 0, name: '' };
        }
        state.sectionDwellTimes[state.currentVisibleSection].time += dwellTime;
      }

      // セクション別滞在時間を送信
      Object.keys(state.sectionDwellTimes).forEach(function(sectionId) {
        const data = state.sectionDwellTimes[sectionId];
        if (data.time > 0) {
          sendToAPI({
            type: 'section_dwell',
            sectionId: sectionId,
            sectionName: data.name,
            dwellSeconds: Math.round(data.time * 10) / 10, // 小数点1桁
          });
        }
      });

      // エンゲージメントサマリーを送信
      const rawTotalDwellTime = Math.round((Date.now() - state.startTime) / 1000);
      const totalDwellTime = Math.min(rawTotalDwellTime, CONFIG.MAX_DWELL_TIME_SECONDS); // 5分でキャップ
      const engagementLevel = calculateEngagementLevel();

      sendToAPI({
        type: 'engagement_summary',
        maxScrollDepth: state.maxScrollDepth,
        totalDwellTime: totalDwellTime,
        engagementLevel: engagementLevel,
        ctaClicked: state.ctaClicked,
        utmSource: state.utmSource,
        utmMedium: state.utmMedium,
        utmCampaign: state.utmCampaign,
      });
    }

    // visibilitychange で送信（より確実）
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        sendSummary();
      }
    });

    // pagehide でも送信（Safari対応）
    window.addEventListener('pagehide', sendSummary);
  }

  // ========== 初期化 ==========
  function init() {
    const params = parseUrlParams();

    if (!params.lpId) {
      console.warn('[LP Tracking] LP ID not found in URL');
      return;
    }

    // 状態を初期化
    state.sessionId = getSessionId();
    state.lpId = params.lpId;
    state.campaignCode = params.campaignCode;
    state.utmSource = params.utmSource;
    state.utmMedium = params.utmMedium;
    state.utmCampaign = params.utmCampaign;

    // localStorage保存
    storeToLocalStorage(params);

    // 各トラッキング機能を初期化
    trackPageView();
    initScrollTracking();
    initDwellTracking();
    initClickTracking();
    initSectionTracking();
    initPageUnloadHandler();

    console.log('[LP Tracking] Initialized', {
      lpId: state.lpId,
      campaignCode: state.campaignCode,
      sessionId: state.sessionId,
    });
  }

  // グローバルに公開（カスタムイベント用）
  window.lpTracking = {
    trackClick: function(buttonId, buttonText) {
      sendToAPI({
        type: 'click',
        buttonId: buttonId,
        buttonText: buttonText,
      });
    },
    trackPageView: trackPageView,
    getState: function() {
      return { ...state };
    },
  };

  // 初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
