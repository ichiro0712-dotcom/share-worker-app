import assert from 'node:assert/strict';
import test from 'node:test';

import { decideApplyCompleteEvents, decideUserIdPush, pushUserIdentified } from '../ga4-events';

// ============================================================
// decideUserIdPush: push 判定ロジック（純粋関数）
// ============================================================

// ---------- 通常系 ----------

test('decideUserIdPush: ゲスト初回（id=null, last=null）は push しない', () => {
    assert.deepEqual(decideUserIdPush(null, null, false, false), {
        push: false,
        nextLastPushedId: null,
    });
});

test('decideUserIdPush: ログイン済み初回（id=123, last=null）は push する（②初回読み込み）', () => {
    assert.deepEqual(decideUserIdPush('123', null, false, false), {
        push: true,
        nextLastPushedId: '123',
    });
});

test('decideUserIdPush: 同一ユーザーの再レンダリング/SPA遷移（id=123, last=123）は push しない', () => {
    assert.deepEqual(decideUserIdPush('123', '123', false, false), {
        push: false,
        nextLastPushedId: '123',
    });
});

test('decideUserIdPush: 新規ログインで未認証→認証へ変化（id=123, last=null）は push する（①ログイン直後）', () => {
    assert.deepEqual(decideUserIdPush('123', null, false, false), {
        push: true,
        nextLastPushedId: '123',
    });
});

// ---------- イレギュラー系 ----------

test('[イレギュラー] ログアウト（id=null, last=123）: push せず last を null にリセット', () => {
    // リセットしないと「同一ユーザー再ログイン」で再 push されなくなるため重要
    assert.deepEqual(decideUserIdPush(null, '123', false, false), {
        push: false,
        nextLastPushedId: null,
    });
});

test('[イレギュラー] ログアウト→同一ユーザー再ログイン: 再度 push される', () => {
    // 1) ログイン
    const afterLogin = decideUserIdPush('123', null, false, false);
    assert.equal(afterLogin.push, true);
    // 2) ログアウト（last がリセットされる）
    const afterLogout = decideUserIdPush(null, afterLogin.nextLastPushedId, false, false);
    assert.equal(afterLogout.push, false);
    assert.equal(afterLogout.nextLastPushedId, null);
    // 3) 同一ユーザーで再ログイン → 再 push される
    const afterRelogin = decideUserIdPush('123', afterLogout.nextLastPushedId, false, false);
    assert.deepEqual(afterRelogin, { push: true, nextLastPushedId: '123' });
});

test('[イレギュラー] ユーザー切替（A=123 → B=456）: 新ユーザーで push する', () => {
    assert.deepEqual(decideUserIdPush('456', '123', false, false), {
        push: true,
        nextLastPushedId: '456',
    });
});

test('[イレギュラー] セッション解決中（isLoading=true）: push せず状態を保持', () => {
    assert.deepEqual(decideUserIdPush('123', '123', true, false), {
        push: false,
        nextLastPushedId: '123',
    });
});

test('[イレギュラー] セッション再取得中の一時的な id=null（isLoading=true）でリセットしない', () => {
    // 一時的に user が null になっても、isLoading 中は last を保持し誤リセットを防ぐ
    assert.deepEqual(decideUserIdPush(null, '123', true, false), {
        push: false,
        nextLastPushedId: '123',
    });
});

test('[イレギュラー] 管理者系ページ（isExcluded=true）: ログイン中でも push せず状態保持', () => {
    assert.deepEqual(decideUserIdPush('123', null, false, true), {
        push: false,
        nextLastPushedId: null,
    });
});

test('[イレギュラー] 除外ページから worker ページへ戻ると push される', () => {
    // /admin 滞在中は状態保持(null) → worker ページ復帰で push
    const onAdmin = decideUserIdPush('123', null, false, true);
    assert.deepEqual(onAdmin, { push: false, nextLastPushedId: null });
    const backToWorker = decideUserIdPush('123', onAdmin.nextLastPushedId, false, false);
    assert.deepEqual(backToWorker, { push: true, nextLastPushedId: '123' });
});

// ============================================================
// pushUserIdentified: dataLayer への push（副作用）
// ============================================================

function withWindow(initial: unknown, fn: () => void) {
    const g = globalThis as Record<string, unknown>;
    const had = 'window' in g;
    const prev = g.window;
    g.window = initial as object;
    try {
        fn();
    } finally {
        if (had) g.window = prev;
        else delete g.window;
    }
}

// ============================================================
// decideApplyCompleteEvents: job_apply_complete の種別・発火回数
// ============================================================

// ---------- 通常系 ----------

test('decideApplyCompleteEvents: 通常応募3件（全件新規）→ normal を3回', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, 3, 3), {
        applyType: 'normal',
        count: 3,
    });
});

test('decideApplyCompleteEvents: 通常応募1件 → normal を1回', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, 1, 1), {
        applyType: 'normal',
        count: 1,
    });
});

test('decideApplyCompleteEvents: オファー承諾 → offer を1回（件数引数に依らず）', () => {
    assert.deepEqual(decideApplyCompleteEvents(true, null, 1), {
        applyType: 'offer',
        count: 1,
    });
});

// ---------- イレギュラー系 ----------

test('[イレギュラー] 3件選択のうち1件が応募済み → 新規2件ぶんだけ発火（過剰カウントなし）', () => {
    // applicationIds.length=2（サーバーが重複応募を除外した結果）。selectedCount=3 は使わない
    assert.deepEqual(decideApplyCompleteEvents(false, 2, 3), {
        applyType: 'normal',
        count: 2,
    });
});

test('[イレギュラー] applicationIds が取得できない(null) → selectedCount にフォールバック', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, null, 3), {
        applyType: 'normal',
        count: 3,
    });
});

test('[イレギュラー] applicationIds=0 件 → 0回（発火しない）', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, 0, 3), {
        applyType: 'normal',
        count: 0,
    });
});

test('[イレギュラー] 負値が来ても count は 0 にクランプ', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, -1, 3), {
        applyType: 'normal',
        count: 0,
    });
});

test('[イレギュラー] オファーは applicationIds の値に関係なく常に1回', () => {
    assert.deepEqual(decideApplyCompleteEvents(true, 5, 5), {
        applyType: 'offer',
        count: 1,
    });
});

test('[イレギュラー] applicationIdsLength=NaN → 0回（非有限値を正規化）', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, Number.NaN, 3), {
        applyType: 'normal',
        count: 0,
    });
});

test('[イレギュラー] applicationIdsLength=Infinity → 0回（暴走防止）', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, Number.POSITIVE_INFINITY, 3), {
        applyType: 'normal',
        count: 0,
    });
});

test('[イレギュラー] 小数が来たら floor して整数回（2.9 → 2）', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, 2.9, 3), {
        applyType: 'normal',
        count: 2,
    });
});

test('[イレギュラー] null かつ選択0件（モーダル誤操作等）→ 0回', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, null, 0), {
        applyType: 'normal',
        count: 0,
    });
});

test('[イレギュラー] 大量一括応募（30件）→ 件数どおり30回', () => {
    assert.deepEqual(decideApplyCompleteEvents(false, 30, 30), {
        applyType: 'normal',
        count: 30,
    });
});

test('[イレギュラー] 二重送信2回目相当（applicationIds=空=0件）→ 発火なし', () => {
    // サーバーが重複応募を除外し新規0件で success になった場合でも過剰発火しない
    assert.deepEqual(decideApplyCompleteEvents(false, 0, 3), {
        applyType: 'normal',
        count: 0,
    });
});

test('pushUserIdentified: dataLayer 既存時に user_identified を push する', () => {
    withWindow({ dataLayer: [] }, () => {
        pushUserIdentified('123');
        const dl = (globalThis as any).window.dataLayer;
        assert.equal(dl.length, 1);
        assert.deepEqual(dl[0], { event: 'user_identified', user_id: '123' });
    });
});

test('[イレギュラー] pushUserIdentified: GTM未ロードで dataLayer 未生成でも取りこぼさない', () => {
    // window はあるが dataLayer が無い状態（afterInteractive で GTM 未読込）
    withWindow({}, () => {
        pushUserIdentified('123');
        const dl = (globalThis as any).window.dataLayer;
        assert.ok(Array.isArray(dl), 'dataLayer が自前生成されること');
        assert.equal(dl.length, 1);
        assert.deepEqual(dl[0], { event: 'user_identified', user_id: '123' });
    });
});

test('[イレギュラー] pushUserIdentified: 既存 dataLayer のキューを破壊せず追記する', () => {
    withWindow({ dataLayer: [{ event: 'gtm.js' }, { event: 'lp_pageview' }] }, () => {
        pushUserIdentified('999');
        const dl = (globalThis as any).window.dataLayer;
        assert.equal(dl.length, 3);
        assert.deepEqual(dl[2], { event: 'user_identified', user_id: '999' });
    });
});

test('[イレギュラー] pushUserIdentified: SSR（window 未定義）でも例外を投げず no-op', () => {
    const g = globalThis as Record<string, unknown>;
    const had = 'window' in g;
    const prev = g.window;
    if (had) delete g.window;
    try {
        assert.doesNotThrow(() => pushUserIdentified('123'));
    } finally {
        if (had) g.window = prev;
    }
});
