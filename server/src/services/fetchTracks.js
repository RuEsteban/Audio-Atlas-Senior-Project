// server/src/services/fetchTracks.js

import trackRepo from '../database/trackRepo.js'

// Create a small amount of in-memory cache for chart reads
// Hold for 5 minutes so repeated UI clicks retrieve data from memory rather than DB
// This will reduce DB load, network latency, and UI response time

const CACHE_TTL_MS = 5 * 60 * 1000
const chartCache = new Map()  // new in-memory key-value store

function buildCacheKey(source, date, country) {     // create a unique identifier for each chart request
  return `${source}:${date}:${country}`.toLowerCase()
}

function getCachedValue(key) {
  const entry = chartCache.get(key)
  if (!entry) return null           // cache miss -> query database
  const isExpired = Date.now() > entry.expiresAt    // verifies validity of cache entry
  if (isExpired) {
    chartCache.delete(key)          // delete expired keys to prevent memory growth and stale data
    return null
  }
  return entry.value                // avoids a db query since value still cached
}

function setCachedValue(key, value) {     // stores the query result in the cache
  chartCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  })
}

export function clearChartCache() {       // use after bulk ingests to data freshness
  chartCache.clear()
}

export function clearChartCacheKey(source, date, country) {    // use to clear one specific chart cache entry
  const key = buildCacheKey(source, date, country)
  chartCache.delete(key)
}

export function clearChartCacheByPrefix(source, date) {   // clear all cache entries for provider/date
  const prefix = `${source}:${date}:`.toLowerCase()

  for (const key of chartCache.keys()) {
    if (key.startsWith(prefix)) {
      chartCache.delete(key)
    }
  }
}

const fetchTopTracks = async (source, date, country) => {
  try {
    const cacheKey = buildCacheKey(source, date, country)

    const cached = getCachedValue(cacheKey)   // return cached response if exists and not expired
    if (cached) {
      return cached
    }

    // get raw data from the database if cache not exists
    const rawData = await trackRepo(source, date, country)

    /* Because front end is using raw data format, there is no need for json conversion
    // change supabase format to json 
      const tracks = rawData.map(track => ({
        // each iteration is an element in array
        rank: track.rank,
        title: track.track_name,
        artist: track.artist_name,
        album: track.album_name,
        release_year: track.release_year,
        image_url: track.image_url || null,
        external_url: track.external_url
      }))
    */
    const response = {
      topSongs: rawData
    }

    setCachedValue(cacheKey, response)    // store in short lived cache for repeated UI clicks

    return response

  } catch (error) {
    throw new Error(`Failed to fetch top tracks: ${error.message}`);
  }
}

export default fetchTopTracks