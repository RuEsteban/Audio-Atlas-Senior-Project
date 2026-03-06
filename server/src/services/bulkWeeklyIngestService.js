// server/src/services/bulkWeeklyIngestService.js

/**
 * Weekly bulk ingest service iterating all configured countries on both providers
 * Records successess and failures without killing the whole batch
 */
import { getLastfmSupportedCountries, getKworbSupportedCountries} from '../config/countryMappings.js'
import { ingestLastfmCountryTopTracks, ingestSpotifyCountryTopTracks} from './chartAggregationService.js'

function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10)
}

async function mapLimit(items, limit, fn) {
    const results = new Array(items.length)
    let i = 0

    const workers = Array.from({ length: limit }, async () => {
        while (i < items.length) {
            const idx = i++
        results[idx] = await fn(items[idx], idx)
        }
    })

    await Promise.all(workers)
    return results
}

export async function ingestAllLastfmWeeklyCharts({
    supabase,
    chartDate = isoDate(),
    limit = 10,
    concurrency = 4
} = {}) {
    if (!supabase) throw new Error('Supabase client is required')

    const countries = getLastfmSupportedCountries()

    const results = await mapLimit(countries, concurrency, async (country) => {
        try {
            const result = await ingestLastfmCountryTopTracks({
                supabase,
                country,
                chartDate,
                limit,
                chartType: 'top_tracks'
            })

            return {
                provider: 'lastfm',
                country,
                ok: true,
                upserted: result?.upserted ?? 0,
                error: null
            }
        } catch (error) {
            return {
                provider: 'lastfm',
                country,
                ok: false,
                upserted: 0,
                error: error?.message ?? String(error)
            }
        }
    })

    return {
        provider: 'lastfm',
        chartDate,
        attempted: countries.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results
    }
}

export async function ingestAllSpotifyWeeklyCharts({
    supabase,
    chartDate = isoDate(),
    limit = 10,
    concurrency = 4
} = {}) {
    if (!supabase) throw new Error('Supabase client is required')

    const countries = getKworbSupportedCountries()

    const results = await mapLimit(countries, concurrency, async (country) => {
        try {
            const result = await ingestSpotifyCountryTopTracks({
                supabase,
                country,
                chartDate,
                limit,
                chartType: 'top_tracks',
                timespan: 'weekly'
            })

            return {
                provider: 'spotify',
                country,
                ok: true,
                upserted: result?.upserted ?? 0,
                error: null
            }
        } catch (error) {
            return {
                provider: 'spotify',
                country,
                ok: false,
                upserted: 0,
                error: error?.message ?? String(error)
            }
        }
    })

    return {
        provider: 'spotify',
        chartDate,
        attempted: countries.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results
    }
}

export async function ingestAllWeeklyCharts({
    supabase,
    chartDate = isoDate(),
    limit = 10,
    concurrency = 4
} = {}) {
    if (!supabase) throw new Error('Supabase client is required')

    const [lastfm, spotify] = await Promise.all([
        ingestAllLastfmWeeklyCharts({
            supabase,
            chartDate,
            limit,
            concurrency
        }),
        ingestAllSpotifyWeeklyCharts({
            supabase,
            chartDate,
            limit,
            concurrency
        })
    ])

    return {
        ok: true,
        chartDate,
        providers: {
            lastfm,
            spotify
        }
    }
}