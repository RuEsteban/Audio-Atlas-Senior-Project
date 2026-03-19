/* Validate routes without calling on API endpoints using fastify.inject()
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'
import { urlToHttpOptions } from 'node:url'

function mockFetch(routes) {
    return async (url, options = {}) => {
        const u = typeof url === 'string' ? url : url.toString()
        for (const r of routes) {
            if (r.match(u, options)) {
                return r.respond(u, options)
            }
        }
        throw new Error('Unexpected fetch: ${u}')
    }
}

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return body}
    }
}

function makeFakeSupabase({ shouldError = false } = {}) {
    return {
        from() {
            return {
                select() {
                    return {
                        async limit() {
                            if (shouldError) return { data: null, error: { message: 'db error' } }
                            return { data: [{ id: 1 }], error: null }
                        }
                    }
                }
            }
        }
    }
}

test('GET /health/supabase returns ok=true when query succeeds', async () => {
    const app = buildApp({ enableSupabase: false })

    // IMPORTANT: decorate BEFORE inject triggers app readiness
    app.decorate('supabase', makeFakeSupabase())

    const res = await app.inject({ method: 'GET', url: '/health/supabase' })
    await app.close()

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.provider, 'supabase')
    assert.equal(body.ok, true)
})

test('GET /health/supabase returns ok=false when query errors', async () => {
    const app = buildApp({ enableSupabase: false })
    app.decorate('supabase', makeFakeSupabase({ shouldError: true }))

    const res = await app.inject({ method: 'GET', url: '/health/supabase' })
    await app.close()

    assert.equal(res.statusCode, 502)
    const body = res.json()
    assert.equal(body.provider, 'supabase')
    assert.equal(body.ok, false)
})

test('GET /health/spotify returns ok=true when Spotify token + API succeed', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'x'
    process.env.SPOTIFY_CLIENT_SECRET = 'y'

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch([
        { match: (u, opt) => u.includes('accounts.spotify.com/api/token') && opt.method === 'POST',
            respond: async () => jsonResponse(200, { access_token: 'token123'})
        },
        { match: (u) => u.includes('api.spotify.com/v1/browse/categories'),
            respond: async () => jsonResponse(200, { categories: { items: [{ name: 'Made For You' }]}})
        }
    ])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/health/spotify' })
    await app.close()
    globalThis.fetch = originalFetch

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.provider, 'spotify')
    assert.equal(body.ok, true)
    assert.ok(typeof body.latencyMs === 'number')
})

test('GET /health/lastfm returns ok=true when Last.fm API succeeds', async () => {
    process.env.LASTFM_API_KEY = 'k'

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch([
        {
            match: (u) => u.includes('ws.audioscrobbler.com/2.0/'),
            respond: async () =>
            jsonResponse(200, { tracks: { track: [{ name: 'DtMF' }] } })
        }
    ])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/health/lastfm' })
    await app.close()
    globalThis.fetch = originalFetch

    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.provider, 'lastfm')
    assert.equal(body.ok, true)
})

test('GET /api/combined/:date/:country/top-tracks returns 200', async () => {
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
    assert.ok(Array.isArray(body.topSongs))
})
