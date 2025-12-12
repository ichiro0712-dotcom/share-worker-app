
import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log('--- Starting Scenario 1: Worker Application ---');

        // 1. Login
        console.log('Navigating to login...');
        console.log('Waiting for login page inputs...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

        // Wait for email input
        await page.waitForSelector('input[type="email"]');

        // Use type selector since name attribute is missing
        await page.type('input[type="email"]', 'yamada@example.com');
        await page.type('input[type="password"]', 'password123');

        // Find login button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const loginBtn = buttons.find(b => b.textContent?.includes('ログイン'));
            if (loginBtn) (loginBtn as HTMLElement).click();
        });

        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log('Logged in.');

        // 2. Go to a job page
        const jobUrl = 'http://localhost:3000/jobs/15?date=2025-12-15';
        console.log(`Navigating to job: ${jobUrl}`);
        await page.goto(jobUrl, { waitUntil: 'networkidle0' });

        // 3. Apply
        // Select a date.
        console.log('Selecting a work date...');
        // The UI uses a div with onClick to toggle selection.
        const dateSelected = await page.evaluate(() => {
            // Look for the date card container. It has 'border-2' and 'rounded-card' classes.
            // Or look for any input[type="checkbox"] and click its parent.
            const checks = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const targetCheck = checks.find(c => !(c as HTMLInputElement).disabled);

            if (targetCheck) {
                // Click the checkbox itself or parent
                (targetCheck as HTMLElement).click();
                return true;
            }

            // Fallback: Click the card container if checkbox hidden/not verifiable
            const cards = Array.from(document.querySelectorAll('.rounded-card'));
            // Filter out main image card (which also has rounded-card)
            // Date cards usually contain "時給" or "募集中" or date text
            const dateCard = cards.find(c => c.textContent?.includes('時給') && !c.classList.contains('cursor-not-allowed'));
            if (dateCard) {
                (dateCard as HTMLElement).click();
                return true;
            }

            return false;
        });

        if (!dateSelected) {
            console.log('No available date found to select.');
            // This is critical, we cannot apply without date.
            // Check if full?
            const pageContent = await page.content();
            if (pageContent.includes('募集枠なし') || pageContent.includes('募集終了')) {
                console.log('Job seems full.');
            }
        } else {
            console.log('Date selected.');
            await new Promise(r => setTimeout(r, 1000)); // Wait for state update
        }

        // Check for Apply button update
        console.log('Checking for Apply button...');
        const applyClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            // Button text should change to "X件の日程に応募する"
            const btn = btns.find(b => b.textContent?.includes('応募する') && !b.disabled);
            if (btn) {
                (btn as HTMLElement).click();
                return true;
            }
            return false;
        });

        if (applyClicked) {
            console.log('Clicking Apply button...');
            await new Promise(r => setTimeout(r, 2000));

            // Confirm
            const clickedConfirm = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const confirmBtn = buttons.find(b => b.textContent?.includes('1件の日程に応募する'));
                if (confirmBtn) {
                    (confirmBtn as HTMLElement).click();
                    return true;
                }
                return false;
            });

            if (clickedConfirm) {
                console.log('Confirmed application.');
                await new Promise(r => setTimeout(r, 2000));
            } else {
                console.log('Confirmation button not found. Maybe direct apply?');
            }
        } else {
            // Check if already applied
            const isApplied = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(b => b.textContent?.includes('応募済み'));
            });

            if (isApplied) {
                console.log('Already applied.');
            } else {
                console.error('Apply button not found.');
                // Debug: List all buttons
                const buttons = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('button')).map(b => b.textContent);
                });
                console.log('Available buttons:', buttons);
            }
        }

        // 4. Verify Notification
        console.log('Verifying Notification Log (as System Admin)...');
        // Use a new incognito context to avoid conflict with Worker session
        const context = await browser.createBrowserContext();
        const logPage = await context.newPage();
        try {

            // Login as System Admin first (Explicitly)
            await logPage.goto('http://localhost:3000/system-admin/login', { waitUntil: 'domcontentloaded' });

            await logPage.type('input[type="email"]', 'admin@sworks.com');
            await logPage.type('input[type="password"]', 'password123');

            // Click login button
            const loginClicked = await logPage.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => b.textContent?.includes('ログイン'));
                if (btn) { (btn as HTMLElement).click(); return true; }
                return false;
            });

            if (loginClicked) {
                await logPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
            } else {
                console.error('System Admin Login button not found');
            }

            // Navigate to logs
            await logPage.goto('http://localhost:3000/system-admin/dev-portal/notification-logs', { waitUntil: 'domcontentloaded' });

            // Select 'FACILITY' tab/filter
            await logPage.waitForSelector('select');
            await logPage.evaluate(() => {
                const selects = Array.from(document.querySelectorAll('select'));
                // Assuming the first select is target_type or we find by checking options?
                // The UI code shows target_type is the first select.
                const targetSelect = selects[0];
                if (targetSelect) {
                    targetSelect.value = 'FACILITY';
                    targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            console.log('Selected FACILITY tab via JS.');

            // Wait for loading to finish
            // The table shows "読み込み中..." when loading.
            // We can wait for that to disappear.
            try {
                await logPage.waitForFunction(
                    () => !document.body.innerText.includes('読み込み中...'),
                    { timeout: 5000 }
                );
            } catch (e) {
                console.log('Timeout waiting for loading to finish, maybe it was fast.');
            }

            // Debug: Fetch API directly to check if backend returns logs
            console.log('Debugging API response directly...');
            const apiResponse = await logPage.evaluate(async () => {
                const res = await fetch('/api/system-admin/notification-logs?target_type=FACILITY&limit=5');
                const data = await res.json();
                return data;
            });
            console.log('API Direct Response:', JSON.stringify(apiResponse, null, 2));

            // Wait a bit more for render
            await new Promise(r => setTimeout(r, 2000));

            let found = false;
            let retries = 3;
            while (retries > 0 && !found) {
                const content = await logPage.content();
                if (content.includes('FACILITY_NEW_APPLICATION')) {
                    console.log('SUCCESS: Found FACILITY_NEW_APPLICATION in logs.');
                    found = true;
                } else {
                    console.log(`Log not found, retrying... (${retries} left)`);
                    const logs = await logPage.evaluate(() => {
                        const rows = Array.from(document.querySelectorAll('tbody tr'));
                        return rows.map(r => r.textContent || '');
                    });
                    console.log('Visible rows:', logs);

                    if (logs.some(l => l.includes('ログが見つかりませんでした'))) {
                        console.log('UI says No Logs Found.');
                    }

                    // Refresh or re-select?
                    // Maybe click search button to refresh
                    const searchBtn = await logPage.$('button[type="submit"]');
                    if (searchBtn) await searchBtn.click();

                    await new Promise(r => setTimeout(r, 3000));
                    retries--;
                }
            }

            if (!found) {
                console.error('FAILURE: FACILITY_NEW_APPLICATION not found in logs after retries.');
                // Don't exit 1 here if we want to proceed to Scen 2, but for now strict.
                // process.exit(1); 
                // Let's NOT exit so we can chain scenarios? 
                // But if this fails, Scen 2 might fail if application not created? 
                // We know application IS created from debug script.
                // So this is just verification failure.
                process.exit(1);
            }
            await new Promise(r => setTimeout(r, 2000));

            const content = await logPage.content();
            if (content.includes('FACILITY_NEW_APPLICATION')) {
                console.log('SUCCESS: Found FACILITY_NEW_APPLICATION in logs.');
            } else {
                console.error('FAILURE: FACILITY_NEW_APPLICATION not found in logs.');
                const logs = await logPage.evaluate(() => {
                    return Array.from(document.querySelectorAll('table tbody tr')).map(tr => tr.textContent);
                });
                console.log('Visible logs:', logs);
                process.exit(1);
            }
        } catch (e) {
            console.error('System Admin Log Verify Failed', e);
            // Debug screenshot?
            process.exit(1);
        } finally {
            await context.close();
        }



    } catch (error) {
        console.error('Error in Scenario 1:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
