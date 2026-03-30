import { Client } from "@upstash/qstash";
import 'dotenv/config';
dotenv.config();

/**
 * @returns top chart data of every country from lastFM.
 * 
 * LastFM publishes new data every Friday.
 * Data is from the week previous 7 days (Friday to Thursday).
 * 
 */

function getChartDate() {
    const today = new Date();
    today.setDate(today.getDate() - 1); // Friday-1 = Thursday
    return today.toISOString().split("T")[0];
}

const client = new Client({
    baseUrl: "https://qstash-us-east-1.upstash.io",
    token: process.env.QSTASH_TOKEN
});

async function scheduleLastFm() {
    const chartDate = getChartDate(); 

    const res = await client.schedules.create({
        destination: process.env.BACKEND_URL + "/ingest/weekly/all",
        cron: "0 17 * * 5",  // Friday at 12 PM EST (in UTC format)
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CRON_SECRET}`
        },
        body: {
            provider: "lastfm",
            chartDate,
            limit: 10,
            concurrency: 2
        },
        retries: 3,          // retry up to three times
        retryInterval: 3600  // retry after one hour
    });

    // console.log("Last.fm weekly cron scheduled.", res);
}

scheduleLastFm();