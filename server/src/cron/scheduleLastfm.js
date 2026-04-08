import qstash from '../config/qstashClient.js'
/**
 * @returns top chart data of every country from lastFM.
 * 
 * LastFM publishes new data every Friday.
 * Data is from the week previous 7 days (Friday to Thursday).
 * 
 */



async function scheduleLastFm() {
    const res = await qstash.schedules.create({
        destination: process.env.BACKEND_URL + "/ingest/weekly/all",
        cron: "CRON_TZ=America/New_York 0 11 * * 5",  // Friday at 11:00 AM PM EST 
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            provider: "lastfm",
            limit: 10,
            concurrency: 2
        }),
        retries: 6         // greater the retry count, the longer it takes between each retry
    });

    console.log("Last.fm weekly cron scheduled: ", res);
}

scheduleLastFm();