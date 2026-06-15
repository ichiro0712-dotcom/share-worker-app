import assert from 'node:assert/strict';
import test from 'node:test';

import { decideUserIdPush, pushUserIdentified } from '../ga4-events';

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
