
import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('--- Starting Scenario 3: Facility Cancel ---');

        // 1. Login as Facility Admin
        console.log('Navigating to Facility Login...');
        await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle0' });

        await page.type('input[type="email"]', 'admin15@facility.com');
        await page.type('input[type="password"]', 'password123');

        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const loginBtn = buttons.find(b => b.textContent?.includes('ログイン'));
            if (loginBtn) (loginBtn as HTMLElement).click();
        });

        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log('Logged in as Facility Admin.');

        // 2. Go to Applications page
        console.log('Navigating to Applications...');
        await page.goto('http://localhost:3000/admin/applications', { waitUntil: 'networkidle0' });

        // 3. Find Application from Yamada
        console.log('Looking for application from 山田 太郎 to cancel...');

        // Should be "Scheduled" (マッチング成立 / 勤務予定)
        const cancelled = await page.evaluate(async () => {
            const rows = Array.from(document.querySelectorAll('tr'));
            // Look for Yamada, Matching/Scheduled
            const targetRow = rows.find(r =>
                r.textContent?.includes('山田 太郎') &&
                (r.textContent?.includes('マッチング') || r.textContent?.includes('勤務予定'))
            );

            if (targetRow) {
                // Find Cancel/Delete button? 
                // Usually "詳細" then "キャンセル"? Or "キャンセル" column?
                // Or "ステータス変更"?
                // Let's assume there is a 'キャンセル' button or we open modal.
                const buttons = Array.from(targetRow.querySelectorAll('button'));
                const cancelBtn = buttons.find(b => b.textContent?.includes('キャンセル') || b.textContent?.includes('不採用'));
                // Not "不採用" (Reject), this is "Cancel" after match.
                // Maybe "勤務キャンセル"?
                // If not found, maybe need to click "詳細" (Details) first.

                const detailBtn = buttons.find(b => b.textContent?.includes('詳細'));
                if (detailBtn) {
                    (detailBtn as HTMLElement).click();
                    return 'clicked_detail';
                }

                if (cancelBtn) {
                    (cancelBtn as HTMLElement).click();
                    return 'clicked_cancel';
                }
            }
            return false;
        });

        if (cancelled === 'clicked_detail') {
            await new Promise(r => setTimeout(r, 2000));
            // In detail modal/page
            const modalCancelled = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const cancelBtn = buttons.find(b => b.textContent?.includes('キャンセル') || b.textContent?.includes('中止'));
                if (cancelBtn) {
                    (cancelBtn as HTMLElement).click();
                    return true;
                }
                return false;
            });
            if (modalCancelled) console.log('Clicked Cancel in detail view.');
        } else if (cancelled === 'clicked_cancel') {
            console.log('Clicked Cancel in list view.');
        } else {
            // Fallback: If not found, maybe it's not Matched yet?
            console.log('Matched application not found to cancel.');
        }

        await new Promise(r => setTimeout(r, 2000));

        // Confirm Cancel
        const confirmed = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const confirmBtn = buttons.find(b =>
                (b.textContent?.includes('キャンセルする') || b.textContent?.includes('はい')) &&
                b.closest('[role="dialog"]')
            );
            if (confirmBtn) {
                (confirmBtn as HTMLElement).click();
                return true;
            }
            return false;
        });

        if (confirmed) {
            console.log('Confirmed cancellation.');
            await new Promise(r => setTimeout(r, 2000));
        }

        // 4. Verify Notification
        console.log('Verifying Notification Log (as System Admin)...');
        const context = await browser.createBrowserContext();
        const logPage = await context.newPage();

        // Login as System Admin first (Explicitly)
        await logPage.goto('http://localhost:3000/system-admin/login', { waitUntil: 'domcontentloaded' });

        await logPage.type('input[type="email"]', 'admin@sworks.com');
        await logPage.type('input[type="password"]', 'password123');

        const loginClicked = await logPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent?.includes('ログイン'));
            if (btn) { (btn as HTMLElement).click(); return true; }
            return false;
        });

        if (loginClicked) {
            await logPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
        }

        await logPage.goto('http://localhost:3000/system-admin/dev-portal/notification-logs', { waitUntil: 'domcontentloaded' });

        try {
            await logPage.waitForSelector('table tbody tr', { timeout: 5000 });
            await new Promise(r => setTimeout(r, 2000));

            const content = await logPage.content();
            // WORKER_CANCELLED_BY_FACILITY
            if (content.includes('WORKER_CANCELLED_BY_FACILITY')) {
                console.log('SUCCESS: Found WORKER_CANCELLED_BY_FACILITY in logs.');
            } else {
                console.error('FAILURE: WORKER_CANCELLED_BY_FACILITY not found in logs.');
                process.exit(1);
            }
        } catch (e) {
            console.error('Timeout waiting for logs table', e);
            process.exit(1);
        } finally {
            await context.close();
        }

    } catch (error) {
        console.error('Error in Scenario 3:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
