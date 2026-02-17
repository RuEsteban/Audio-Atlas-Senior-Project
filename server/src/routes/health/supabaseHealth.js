/**
 * Testing API access to Supabase
 * server/.env uploaded, routes inserted into server/src/server.js 
 */

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

export default async function supabaseHealth(fastify) {
  fastify.get('/health/supabase', async (req, reply) => {
    const t0 = nowMs();
    try {
      const supabase = fastify.supabase;

      if (!supabase) {
        return reply.code(500).send({
          provider: 'supabase',
          ok: false,
          latencyMs: nowMs() - t0,
          error: { message: 'Supabase client not found on fastify instance' }
        });
      }

      // Minimal query: select 1 row (or 0 rows if table is empty)
      const { data, error } = await supabase
        .from('music_charts')
        .select('id')
        .limit(1);

      if (error) {
        return reply.code(502).send({
          provider: 'supabase',
          ok: false,
          latencyMs: nowMs() - t0,
          error
        });
      }

      return reply.send({
        provider: 'supabase',
        ok: true,
        latencyMs: nowMs() - t0,
        sample: data?.[0] ?? null
      });
    } catch (err) {
      return reply.code(502).send({
        provider: 'supabase',
        ok: false,
        latencyMs: nowMs() - t0,
        error: { message: err.message }
      });
    }
  });
}
