// server/src/apiClient/lastfmClient.js

/**
 *  Create a per country client to geo.gettoptacks
 */

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    }
    finally { clearTimeout(t) }
}

function buildLastfmUrl(params) {
    const { LASTFM_API_KEY } = process.env
    if (!LASTFM_API_KEY) throw new Error('Missing LASTFM_API_KEY')

    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('api_key', LASTFM_API_KEY)
    url.searchParams.set('format', 'json')

    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, String(v))
        }
    }
    return url
}

/**
 * Per country top tracks
 * Country must be Last.fm recognized country name
 */

export async function fetchLastfmGeoTopTracks({ countryName, limit = 10, page = 1 } = {}) {
    if (!countryName) throw new Error('countryName is required for geo.gettoptracks')

    const url = buildLastfmUrl({
        method: 'geo.gettoptracks',
        country: countryName,
        limit,
        page
    })

    const res = await fetchWithTimeout(url.toString())
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(`Last.fm geo.gettoptracks failed (${res.status})`), { details: json })
    return json
}

/**
 * Attempt to get album and release year information from Lastfm.
 * In geo.gettoptracks, this information is not reliably present
 * Utilize track.getInfo to pull/associate this information
 */

export async function fetchLastfmTrackInfo({ mbid, artistName, trackName } = {}) {
  if (!mbid && (!artistName || !trackName)) {
    throw new Error('fetchLastfmTrackInfo requires mbid OR (artistName + trackName)')
  }

  const url = buildLastfmUrl({
    method: 'track.getInfo',
    mbid: mbid || undefined,
    artist: mbid ? undefined : artistName,
    track: mbid ? undefined : trackName,
    autocorrect: 1
  })

  const res = await fetchWithTimeout(url.toString())
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(`Last.fm track.getInfo failed (${res.status})`), { details: json })
  return json
}
