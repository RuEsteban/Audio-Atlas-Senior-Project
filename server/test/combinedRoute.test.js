import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'

test('GET /api/combined/:date/:country/top-tracks returns combined chart response', async () => {
    const app = buildApp()

    const res = await app.inject({
        method: 'GET',
        url: '/api/combined/2026-03-05/US/top-tracks'
    })

    await app.close()

    assert.equal(res.statusCode, 200)

    const body = res.json()

    assert.equal(body.country, 'US')
    assert.equal(body.chartDate, '2026-03-05')
    assert.ok(typeof body.count === 'number')
    assert.ok(Array.isArray(body.topSongs))

    if (body.topSongs.length > 0) {
        const first = body.topSongs[0]

        assert.ok(typeof first.aggregate_rank === 'number')
        assert.ok(typeof first.combined_score === 'number')
        assert.ok(Array.isArray(first.sources_present))

        assert.ok('track_name' in first)
        assert.ok('artist_name' in first)
        assert.ok('spotify_rank' in first)
        assert.ok('lastfm_rank' in first)
        assert.ok('spotify_points' in first)
        assert.ok('lastfm_points' in first)

        // aggregated rows should not expose single-source field anymore
        assert.equal('source' in first, false)
    }
})