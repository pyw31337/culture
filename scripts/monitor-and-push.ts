import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function monitorAndPush() {
    console.log('Starting Monitor for Mom-Mom Scrapers...');

    const checkInterval = 30000; // Check every 30 seconds
    const maxWaitTime = 3600000 * 2; // Wait up to 2 hours
    let waitedTime = 0;

    const interval = setInterval(async () => {
        waitedTime += checkInterval;

        try {
            // Check for running node processes
            let stdout = '';
            try {
                const result = await execAsync('ps aux | grep "scrape-mommom" | grep -v "grep" | grep -v "monitor-and-push"');
                stdout = result.stdout;
            } catch (e: any) {
                // If grep fails (code 1), it means NO matches found, so no scrapers are running.
                if (e.code === 1) {
                    stdout = '';
                } else {
                    throw e;
                }
            }

            if (stdout.trim().length > 0) {
                const lines = stdout.trim().split('\n');
                console.log(`[${new Date().toLocaleTimeString()}] Scrapers still running (${lines.length} processes)...`);

                if (waitedTime > maxWaitTime) {
                    console.error('Max wait time exceeded. Stopping monitor.');
                    clearInterval(interval);
                }
            } else {
                // No scrapers running
                console.log('All scrapers finished. Initiating Git update...');
                clearInterval(interval);

                // Run Git commands
                try {
                    console.log('Adding files...');
                    await execAsync('git add src/data/mommom.json src/data/mommom-food.json src/lib/performance-data.ts src/lib/constants.ts src/components/GenreIcons.tsx src/app/page.tsx scripts/scrape-mommom-food.ts scripts/monitor-and-push.ts scripts/scrape-mommom.ts');

                    console.log('Committing...');
                    await execAsync('git commit -m "Auto: Update Mom-Mom data and Food category"');

                    console.log('Pushing...');
                    await execAsync('git push');

                    console.log('Successfully pushed updates to Git.');

                    // Optional: Notification (Mac OS)
                    execAsync('osascript -e \'display notification "Mom-Mom Data Updated & Pushed" with title "CultureFlow Agent"\'').catch(() => { });

                } catch (e) {
                    console.error('Git operation failed:', e);
                }
            }
        } catch (e) {
            console.error('Error checking processes:', e);
        }
    }, checkInterval);
}

monitorAndPush();
