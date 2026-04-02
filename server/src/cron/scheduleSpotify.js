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
        cron: "0 18 * * 4",  // Thursday at 12:30 PM EST (in UTC format) offset by 30 minutes from lastfm
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CRON_SECRET}`
        },
        body: {
            provider: "spotify",
            limit: 10,
            concurrency: 2
        },
        retries: 3,          // retry up to three times
        retryInterval: 3600  // retry after one hour
    });

    console.log('Spotify weekly cron scheduled: ', res);
}

scheduleSpotify();