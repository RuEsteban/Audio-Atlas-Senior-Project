/**
 * Testing API access to Spotify and Last.fm
 * server/.env uploaded, routes inserted into server/src/server.js 
 */

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function getSpotifyAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({ grant_type: 'client_credentials' });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`
    },
    body
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(`Spotify token request failed (${res.status})`), {
      httpStatus: res.status,
      details: data
    });
  }

  if (!data?.access_token) throw new Error('Spotify token response missing access_token');
  return data.access_token;
}

function validateSpotifyCategories(data) {
  const items = data?.categories?.items;
  return Array.isArray(items) && items.length > 0 && typeof items[0]?.name === 'string';
}

function validateLastFmTopTracks(data) {
  const tracks = data?.tracks?.track;
  return Array.isArray(tracks) && tracks.length > 0 && typeof tracks[0]?.name === 'string';
}

export default async function healthRoutes(fastify) {
  fastify.get('/health', async () => ({ ok: true }));

  fastify.get('/health/spotify', async (req, reply) => {
    const t0 = nowMs();
    try {
      const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return reply.code(500).send({
          provider: 'spotify',
          ok: false,
          latencyMs: nowMs() - t0,
          error: { message: 'Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in environment' }
        });
      }

      const token = await getSpotifyAccessToken(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);

      const res = await fetchWithTimeout('https://api.spotify.com/v1/browse/categories?limit=5', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(`Spotify API request failed (${res.status})`), {
          httpStatus: res.status,
          details: data
        });
      }

      const ok = validateSpotifyCategories(data);

      return reply.send({
        provider: 'spotify',
        ok,
        latencyMs: nowMs() - t0,
        sample: ok ? { firstCategory: data.categories.items[0] } : null
      });
    } catch (err) {
      return reply.code(502).send({
        provider: 'spotify',
        ok: false,
        latencyMs: nowMs() - t0,
        error: {
          message: err.message,
          httpStatus: err.httpStatus ?? null,
          details: err.details ?? null
        }
      });
    }
  });

  fastify.get('/health/lastfm', async (req, reply) => {
    const t0 = nowMs();
    try {
      const { LASTFM_API_KEY } = process.env;
      if (!LASTFM_API_KEY) {
        return reply.code(500).send({
          provider: 'lastfm',
          ok: false,
          latencyMs: nowMs() - t0,
          error: { message: 'Missing LASTFM_API_KEY in environment' }
        });
      }

      const url = new URL('https://ws.audioscrobbler.com/2.0/');
      url.searchParams.set('method', 'chart.gettoptracks');
      url.searchParams.set('api_key', LASTFM_API_KEY);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '5');

      const res = await fetchWithTimeout(url.toString(), {});
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw Object.assign(new Error(`Last.fm API request failed (${res.status})`), {
          httpStatus: res.status,
          details: data
        });
      }

      const ok = validateLastFmTopTracks(data);

      return reply.send({
        provider: 'lastfm',
        ok,
        latencyMs: nowMs() - t0,
        sample: ok ? { firstTrack: data.tracks.track[0] } : null
      });
    } catch (err) {
      return reply.code(502).send({
        provider: 'lastfm',
        ok: false,
        latencyMs: nowMs() - t0,
        error: {
          message: err.message,
          httpStatus: err.httpStatus ?? null,
          details: err.details ?? null
        }
      });
    }
  });
}
