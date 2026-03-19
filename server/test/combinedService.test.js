import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanTrackTitle,
  normalizeText,
  buildMatchKey,
  rankToPoints,
  aggregateRows
} from '../src/services/chartAggregationCombinedCore.js'

test('rankToPoints converts ranks to expected scores', () => {
    assert.equal(rankToPoints(1), 10)
    assert.equal(rankToPoints(2), 9)
    assert.equal(rankToPoints(10), 1)
    assert.equal(rankToPoints(11), 0)
    assert.equal(rankToPoints(null), 0)
})

test('cleanTrackTitle removes collaboration suffixes', () => {
    assert.equal(cleanTrackTitle('Rein Me In (w/ Olivia Dean)'), 'Rein Me In')
    assert.equal(cleanTrackTitle('Song Name (feat. Drake)'), 'Song Name')
    assert.equal(cleanTrackTitle('Another Song (ft. SZA)'), 'Another Song')
})

test('normalizeText normalizes accents, punctuation, and whitespace', () => {
    assert.equal(normalizeText('  BAILE INoLVIDABLE  '), 'baile inolvidable')
    assert.equal(normalizeText('daño'), 'dano')
    assert.equal(normalizeText('Hello!!!   World'), 'hello world')
})

test('buildMatchKey prefers spotify_track_id and falls back to cleaned text key', () => {
    const withId = buildMatchKey({
        spotify_track_id: 'abc123',
        track_name: 'Song',
        artist_name: 'Artist'
    })
    assert.equal(withId, 'spotify:abc123')

    const withoutId = buildMatchKey({
        spotify_track_id: null,
        track_name: 'Rein Me In (w/ Olivia Dean)',
        artist_name: 'Sam Fender'
    })
    assert.equal(withoutId, 'text:rein me in::sam fender')
})

test('aggregateRows merges shared songs and sums provider points', () => {
    const rows = [
        {
            source: 'spotify',
            chart_date: '2026-03-05',
            country: 'US',
            rank: 1,
            track_name: 'Risk It All',
            artist_name: 'Bruno Mars',
            album_name: 'The Romantic',
            release_year: 2026,
            image_url: 'spotify-image',
            external_url: 'spotify-link',
            spotify_track_id: 'track123'
        },
        {
            source: 'lastfm',
            chart_date: '2026-03-05',
            country: 'US',
            rank: 2,
            track_name: 'Risk It All',
            artist_name: 'Bruno Mars',
            album_name: null,
            release_year: null,
            image_url: null,
            external_url: null,
            spotify_track_id: 'track123'
        },
        {
            source: 'spotify',
            chart_date: '2026-03-05',
            country: 'US',
            rank: 3,
            track_name: 'Spotify Only Song',
            artist_name: 'Artist A',
            album_name: 'Album A',
            release_year: 2025,
            image_url: 'img-a',
            external_url: 'link-a',
            spotify_track_id: 'track999'
        },
        {
            source: 'lastfm',
            chart_date: '2026-03-05',
            country: 'US',
            rank: 1,
            track_name: 'Lastfm Only Song',
            artist_name: 'Artist B',
            album_name: null,
            release_year: null,
            image_url: null,
            external_url: null,
            spotify_track_id: null
        }
    ]

    const result = aggregateRows(rows, 10)

    assert.equal(result.length, 3)

    const merged = result.find((r) => r.match_key === 'spotify:track123')
    assert.ok(merged)

    assert.equal(merged.spotify_rank, 1)
    assert.equal(merged.lastfm_rank, 2)
    assert.equal(merged.spotify_points, 10)
    assert.equal(merged.lastfm_points, 9)
    assert.equal(merged.combined_score, 19)

    assert.deepEqual([...merged.sources_present].sort(), ['lastfm', 'spotify'])

    // prefer Spotify metadata when rows merge
    assert.equal(merged.album_name, 'The Romantic')
    assert.equal(merged.image_url, 'spotify-image')
    assert.equal(merged.external_url, 'spotify-link')

    // highest combined score should rank first
    assert.equal(result[0].match_key, 'spotify:track123')
})