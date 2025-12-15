
import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('--- Starting Scenario 2: Facility Approval ---');

        // 1. Login as Facility Admin
        console.log('Navigating to Facility Login...');
        await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle0' });

        await page.waitForSelector('input[type="email"]');
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
        console.log('Looking for application from 山田 太郎...');
        // We need to find a row that contains "山田 太郎" and has status "応募中" (Applied) or verify it's there.
        // And click "承認" (Approve) button in that row.

        const approved = await page.evaluate(async () => {
            // Find rows
            const rows = Array.from(document.querySelectorAll('tr'));
            // Find row with Yamada
            const targetRow = rows.find(r => r.textContent?.includes('山田 太郎') && r.textContent?.includes('応募中'));

            if (targetRow) {
                // Find Approve button in this row
                const buttons = Array.from(targetRow.querySelectorAll('button'));
                const approveBtn = buttons.find(b => b.textContent?.includes('承認'));
                if (approveBtn) {
                    (approveBtn as HTMLElement).click();
                    return true;
                }
            }
            return false;
        });

        if (approved) {
            console.log('Clicked Approve button.');
            await new Promise(r => setTimeout(r, 2000));

            // Confirm if there is a modal
            // Usually "承認しますか？" -> "承認する"
            const confirmed = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                // Look for a confirmation button in a modal/dialog
                const confirmBtn = buttons.find(b => b.textContent?.includes('承認する') && b.closest('[role="dialog"]'));
                // Or just any '承認する' visible
                if (confirmBtn) {
                    (confirmBtn as HTMLElement).click();
                    return true;
                }
                return false;
            });

            if (confirmed) {
                console.log('Confirmed approval in modal.');
                await new Promise(r => setTimeout(r, 2000));
            } else {
                console.log('No confirmation modal found, maybe direct approval?');
            }

        } else {
            console.log('Application not found or already approved?');
            // Check if already approved
            const isApproved = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('tr'));
                return rows.some(r => r.textContent?.includes('山田 太郎') && (r.textContent?.includes('承認済み') || r.textContent?.includes('マッチング')));
            });

            if (isApproved) {
                console.log('Application is already approved.');
            } else {
                console.error('Could not find application to approve.');
                // Don't exit error here as we might want to check logs anyway if it was just approved
            }
        }

        // 4. Verify Notification
        console.log('Verifying Notification Log (as System Admin)...');
        const context = await browser.createBrowserContext();
        const logPage = await context.newPage();

        // Login as System Admin first (Explicitly)
        await logPage.goto('http://localhost:3000/system-admin/login', { waitUntil: 'domcontentloaded' });

        await logPage.type('input[type="email"]', 'admin@tastas.jp');
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

        // Navigate to logs
        await logPage.goto('http://localhost:3000/system-admin/dev-portal/notification-logs', { waitUntil: 'domcontentloaded' });

        try {
            await logPage.waitForSelector('table tbody tr', { timeout: 5000 });
            await new Promise(r => setTimeout(r, 2000));

            // Check for WORKER_MATCHED
            const content = await logPage.content();
            if (content.includes('WORKER_MATCHED')) {
                console.log('SUCCESS: Found WORKER_MATCHED in logs.');
            } else {
                console.error('FAILURE: WORKER_MATCHED not found in logs.');
                process.exit(1);
            }
        } catch (e) {
            console.error('Timeout waiting for logs table', e);
            process.exit(1);
        } finally {
            await context.close();
        }

    } catch (error) {
        console.error('Error in Scenario 2:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
