// server/scripts/backfillLastfmMetadata.js

import 'dotenv/config'
import supabase from '../src/database/supabaseClient.js'
import { searchTrack } from '../src/apiClient/spotifyClient.js'

function yearFromSpotifyReleaseDate(releaseDate) {
  if (!releaseDate) return null
  const m = String(releaseDate).match(/^(19|20)\d{2}/)
  return m ? Number(m[0]) : null
}

async function fetchAllLastfmRows(targetDate, targetCountry = null) {
  const pageSize = 500
  let from = 0
  const allRows = []

  while (true) {

    const source = 'lastfm'         // can change this to spotify to perform the same function

    let query = supabase
      .from('music_charts')
      .select('id, country, rank, track_name, artist_name, image_url')
      .eq('source', source)
      .eq('chart_date', targetDate)
      .is('image_url', null)        // will only run API calls on missing image_url

    if (targetCountry) {
      query = query.eq('country', targetCountry)
    }

    const to = from + pageSize - 1

    const { data, error } = await query
      .order('country')
      .order('rank')
      .range(from, to)

    if (error) throw error

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)
    console.log(`Fetched rows ${from}-${to}: ${data.length}`)

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}

async function main() {
  const targetDate = '2026-03-05'       // change to whatever date may have concern
  const targetCountry = null            // set to 'US' for single country before testing on entire db

  const rows = await fetchAllLastfmRows(targetDate, targetCountry)

  if (!rows || rows.length === 0) {
    console.log('No rows found')
    return
  }

  console.log(`Found ${rows.length} rows to backfill`)

  let updatedCount = 0
  let skippedCount = 0
  let noMatchCount = 0
  let failedCount = 0

  for (const row of rows) {
    try {
      // Skip rows already backfilled
      if (row.image_url) {
        skippedCount += 1
        continue
      }

      const s = await searchTrack(row.track_name, row.artist_name)

      if (!s) {
        noMatchCount += 1
        console.log(`No Spotify match: ${row.country} #${row.rank} ${row.artist_name} - ${row.track_name}`)
        continue
      }

      const patch = {
        spotify_track_id: s.id ?? null,
        spotify_popularity: Number.isFinite(s.popularity) ? s.popularity : null,
        external_url: s.external_urls?.spotify ?? null,
        image_url: s.album?.images?.[0]?.url ?? null,
        album_name: s.album?.name ?? null,
        release_year: yearFromSpotifyReleaseDate(s.album?.release_date),
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('music_charts')
        .update(patch)
        .eq('id', row.id)

      if (updateError) {
        failedCount += 1
        console.error(`Update failed for id=${row.id}`, updateError.message)
      } else {
        updatedCount += 1
        console.log(`Updated ${row.country} #${row.rank}: ${row.artist_name} - ${row.track_name}`)
      }
    } catch (err) {
      failedCount += 1
      console.error(`Backfill failed for id=${row.id}`, err.message)
    }
  }

  console.log('Backfill complete')
  console.log(`Updated: ${updatedCount}`)
  console.log(`Skipped existing: ${skippedCount}`)
  console.log(`No Spotify match: ${noMatchCount}`)
  console.log(`Failed: ${failedCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})