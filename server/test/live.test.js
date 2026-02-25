import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'

const RUN = process.env.RUN_LIVE_TESTS === '1'

test('LIVE: /health/spotify', { skip: !RUN }, async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/health/spotify' })
  await app.close()

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.provider, 'spotify')
  assert.equal(body.ok, true)
})

test('LIVE: /health/lastfm', { skip: !RUN }, async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/health/lastfm' })
  await app.close()

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.provider, 'lastfm')
  assert.equal(body.ok, true)
})

test('LIVE: /health/supabase', { skip: !RUN }, async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/health/supabase' })
  await app.close()

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.provider, 'supabase')
  assert.equal(body.ok, true)
})