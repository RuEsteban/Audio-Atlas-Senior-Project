import qstash from '../config/qstashClient.js'

/**
 * @returns top chart data of every country from spotify.
 * 
 * Pulls data every Thursday for the previous week via kworb.
 * 
 */


async function scheduleSpotify() {
    const res = await qstash.schedules.create({
        destination: process.env.BACKEND_URL + "/ingest/weekly/all",
        cron: "CRON_TZ=America/New_York 30 11 * * 5",  // Friday at 11:30 AM EST (offset by 30 minutes from lastfm cron)
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            provider: "spotify",
            limit: 10,
            concurrency: 2
        }),
        retries: 6          // retries 6 times. Interval between retry increases with each retry call
    });

    console.log('Spotify weekly cron scheduled: ', res);
}

scheduleSpotify();