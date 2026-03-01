// server/src/services/enrichmentService.js

/**
 * Use Spotify data to fill in data holes from top lists
 */ 

import { searchTrack } from '../apiClient/spotifyClient.js';

function safeYearFromReleaseDate(releaseDate) {
  if (!releaseDate || typeof releaseDate !== 'string') return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Normalizes Spotify track info for addition to DB/upsert layer.
 */

function normalizeSpotifyTrack(spotifyTrack) {
  const primaryArtist = spotifyTrack.artists?.[0] ?? null;
  const album = spotifyTrack.album ?? null;

  return {
    track: {
      title: spotifyTrack.name ?? null,
      spotify_id: spotifyTrack.id ?? null,
      popularity: spotifyTrack.popularity ?? null,
      explicit: spotifyTrack.explicit ?? null
    },
    artist: {
      name: primaryArtist?.name ?? null,
      spotify_id: primaryArtist?.id ?? null
    },
    album: {
      title: album?.name ?? null,
      spotify_id: album?.id ?? null,
      release_date: album?.release_date ?? null,
      release_year: safeYearFromReleaseDate(album?.release_date),
      image_url: album?.images?.[0]?.url ?? null
    }
  };
}

/**
 * Enrich a track using Spotify
 * Input is minimal: trackName + artistName.
 */

export async function enrichTrack({ trackName, artistName }) {
  const spotifyTrack = await searchTrack(trackName, artistName);

  if (!spotifyTrack) {
    return {
      found: false,
      query: { trackName, artistName },
      sources: { spotify: null },
      enriched: null
    };
  }

  return {
    found: true,
    query: { trackName, artistName },
    sources: { spotify: { track_id: spotifyTrack.id } },
    enriched: normalizeSpotifyTrack(spotifyTrack),
    raw: { spotify: spotifyTrack }      // optional debugging/auditing:
  };
}
