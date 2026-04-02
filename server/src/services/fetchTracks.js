import trackRepo from '../database/trackRepo.js';
import redis from '../config/redisClient.js';

// TTL (time to live) in seconds
const CACHE_TTL = 7 * 24 * 60 * 60;

// Build a unique Redis key
function buildCacheKey(source, date, country) {
    return `${source}:${date}:${country}`.toLowerCase();
}

// Clear all cached charts (use after full bulk ingest or emergency)
export async function clearAllCachedCharts() {
  try {
      // delete keys until cursor is 0 (no more keys to delete)
      let cursor = 0;
      do {
          const [nextCursor, keys] = await redis.scan(cursor, { MATCH: '*:*:*', COUNT: 100 });
          cursor = parseInt(nextCursor);
          if (keys.length > 0) {
              await redis.del(...keys);
          }
      } while (cursor !== 0);
      //console.log('All charts cleared from cache.');
  } catch (err) {
      console.error('Failed to clear all chart cache:', err.message);
  }
}

// Clear cache for a specific provider/date/country
export async function clearCachedCountry(source, date, country) {
    try {
        const key = buildCacheKey(source, date, country);
        await redis.del(key);
        console.log(`Cleared cache key: ${key}`);
    } catch (err) {
        console.error('Failed to clear cache key:', err.message);
    }
}

// Clear cache for all countries for a provider/date
export async function clearCachedProvider(source, date) {
    try {
        const prefix = `${source}:${date}:`.toLowerCase();
        let cursor = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
            cursor = parseInt(nextCursor);
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`Cleared ${keys.length} cache keys with prefix: ${prefix}`);
            }
        } while (cursor !== 0);
    } catch (err) {
        console.error('Failed to clear cache by prefix:', err.message);
    }
}


// Helper to safely parse cached data
function formatCacheData(cached) {
    // cache miss
    if (!cached) {
        return null;
    }

    // format check for cache hit data
    if (typeof cached === 'string') {
        return JSON.parse(cached);
    } else {
        return cached;
    }
}

/**
 * Fetch top tracks
 * Checks Redis first; cache miss triggers Supabase query
 */
const fetchTopTracks = async (source, date, country) => {
    try {
        const cacheKey = buildCacheKey(source, date, country);

        // Check Redis cache first : cache hit
        const cached = await redis.get(cacheKey);
        const data = formatCacheData(cached);
        if (data) {
            return data;
        }

        // Cache miss: query Supabase
        const rawData = await trackRepo(source, date, country);

        // do not cache empty information
        if (rawData && rawData.length > 0) { 
            const response = { topSongs: rawData };

            // Store result in Redis with TTL
            await redis.set(cacheKey, JSON.stringify(response), { ex: CACHE_TTL });
            return response;
        } else {
            return { topSongs: rawData }; // return empty to frontend
        }
    } catch (error) {
          throw new Error(`Failed to fetch top tracks: ${error.message}`);
    }
};



export default fetchTopTracks;