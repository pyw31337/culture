
import { fetchPerformances } from '../src/lib/interpark.ts';

async function verify() {
    console.log("Starting data verification...");
    try {
        const perfs = await fetchPerformances();
        console.log(`Fetched ${perfs.length} performances.`);
        if (perfs.length > 0) {
            console.log("Sample:", perfs[0]);
        }
    } catch (e) {
        console.error("Error fetching performances:", e);
    }
}

verify();
