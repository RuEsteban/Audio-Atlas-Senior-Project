import test from 'node:test'
import assert from 'node:assert/strict'
import { validateChartRows } from '../src/services/chartAggregationService.js'

function makeRow(overrides = {}) {
    return {
        chart_key: '2026-03-01:US:top_tracks:spotify:1:abc',
        source: 'spotify',
        chart_date: '2026-03-01',
        country: 'US',
        chart_type: 'top_tracks',
        rank: 1,
        track_name: 'Song',
        artist_name: 'Artist',
        spotify_popularity: 50,
        release_year: 2024,
        playcount: null,
        raw: { provider: 'kworb' },
        ...overrides
    }
}

test('validateChartRows: accepts valid rows', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
        makeRow({
            chart_key: `k${i+1}`,
            rank: i + 1
        })
    )

    const out = validateChartRows(rows, {
        source: 'spotify',
        country: 'US',
        chartDate: '2026-03-01',
        chartType: 'top_tracks',
        limit: 10
    })

    assert.equal(out.length, 10)
})

test('validateChartRows: fails if track_name missing', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
        makeRow({ chart_key: `k${i+1}`, rank: i + 1 })
    )
    rows[3].track_name = null

    assert.throws(() => validateChartRows(rows, {
        source: 'spotify',
        country: 'US',
        chartDate: '2026-03-01',
        chartType: 'top_tracks',
        limit: 10
    }), /track_name missing/)
})

test('validateChartRows: fails on duplicate rank', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
        makeRow({ chart_key: `k${i+1}`, rank: i + 1 })
    )
    rows[9].rank = 1

    assert.throws(() => validateChartRows(rows, {
        source: 'spotify',
        country: 'US',
        chartDate: '2026-03-01',
        chartType: 'top_tracks',
        limit: 10
    }), /duplicate rank/)
})

test('validateChartRows: fails on rank out of bounds', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
        makeRow({ chart_key: `k${i+1}`, rank: i + 1 })
    )
    rows[0].rank = 0

    assert.throws(() => validateChartRows(rows, {
        source: 'spotify',
        country: 'US',
        chartDate: '2026-03-01',
        chartType: 'top_tracks',
        limit: 10
    }), /rank out of bounds/)
})

test('validateChartRows: normalizes spotify_popularity outside 0-100 to null', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
        makeRow({ chart_key: `k${i+1}`, rank: i + 1 })
    )
    rows[0].spotify_popularity = 999

    const out = validateChartRows(rows, {
        source: 'spotify',
        country: 'US',
        chartDate: '2026-03-01',
        chartType: 'top_tracks',
        limit: 10
    })

    assert.equal(out[0].spotify_popularity, null)
})

test('validateChartRows: fails if row count not equal to limit', () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
        makeRow({ chart_key: `k${i+1}`, rank: i + 1 })
    )

    assert.throws(() => validateChartRows(rows, {
        source: 'spotify',
        country: 'US',
        chartDate: '2026-03-01',
        chartType: 'top_tracks',
        limit: 10
    }), /expected 10 rows, got 9/)
})