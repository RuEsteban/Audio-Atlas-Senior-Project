// server/src/apiClient/spotifyClient.js

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

let accessToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
    const now = Date.now();

    if (accessToken && tokenExpiresAt && now < tokenExpiresAt) {
        return accessToken;
    }

    const credentials = Buffer
        .from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`)
        .toString('base64');

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials'
        })
    });

    if (!response.ok) {
        throw new Error(`Spotify token error: ${response.status}`);
    }

    const data = await response.json();

    accessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000) - 5000;

    return accessToken;
}

async function spotifyRequest(endpoint, params = {}, retries = 1) {
    const token = await getAccessToken();

    const queryString = new URLSearchParams(params).toString();
    const url = `${SPOTIFY_API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;

    // Manually implement timeout protection to keep ingestion pipeline from indefinite hang

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        // Implement Spotify 429 handling to prevent ingestion failures and pipeline instability
        // Retry once after 10 seconds and then fail cleanly to prevent hang ups
        
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);

            if (retries > 0) {
                console.warn(`Spotify rate limited. Retrying after ${retryAfter}s...`);
                await new Promise(res => setTimeout(res, retryAfter * 1000));
                return spotifyRequest(endpoint, params, retries - 1);
            } else {
                throw new Error('Spotify rate limit exceeded');
            }
        }

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        clearTimeout(timeout);

        if (error.name === 'AbortError') {
            throw new Error('Spotify request timed out');
        }

        throw error;
    }
}
async function searchTrack(trackName, artistName) {
    const query = `track:${trackName} artist:${artistName}`;

    const data = await spotifyRequest('/search', {
        q: query,
        type: 'track',
        limit: 1
    });

    return data.tracks?.items?.[0] || null;
}

module.exports = {
    searchTrack
};