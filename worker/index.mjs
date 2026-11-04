/** Same-origin gateway to a Worker binding or a fixed HTTPS Node backend. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const admin = url.pathname.startsWith('/api/admin/v1/');
    const media = ['/api/stream/', '/api/file/'].some(path => url.pathname.startsWith(path));
    const fail = (message, status) => Response.json({ error: message }, {
      status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
    if (!admin && !media) return fail('Endpoint not found', 404);
    if (!(admin ? ['GET', 'POST'] : ['GET', 'HEAD']).includes(request.method))
      return fail('Method not allowed', 405);
    if (request.method === 'POST' && (
      request.headers.get('origin') !== url.origin ||
      request.headers.get('x-plugg-admin') !== '1' ||
      request.headers.get('content-type')?.split(';')[0] !== 'application/json'
    )) return fail('Untrusted administrative request', 403);
    if (!env.PLUGG_BACKEND && !env.PLUGG_BACKEND_ORIGIN) return fail('The Plugg backend has not been connected yet.', 503);
    const headers = new Headers(request.headers);
    // Forward only the application's session, never unrelated dashboard cookies.
    const session = headers.get('cookie')?.split(';').map(value => value.trim())
      .find(value => value.startsWith('plugg_session='));
    headers.delete('cookie');
    if (session) headers.set('cookie', session);
    try {
      let upstream;
      if (env.PLUGG_BACKEND) {
        upstream = await env.PLUGG_BACKEND.fetch(new Request(request, { headers, redirect: 'manual' }));
      } else {
        const origin = new URL(env.PLUGG_BACKEND_ORIGIN);
        if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
          return fail('Invalid backend configuration', 503);
        // Use the configured host only; request paths can never choose an upstream host.
        origin.pathname = url.pathname;
        origin.search = url.search;
        headers.delete('host');
        headers.delete('authorization');
        headers.delete('forwarded');
        headers.delete('x-forwarded-host');
        upstream = await fetch(new Request(origin, {
          method: request.method, headers, body: request.method === 'POST' ? request.body : null,
          redirect: 'manual', duplex: 'half',
        }));
      }
      const response = new Response(upstream.body, upstream);
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      return response;
    } catch {
      return fail('The Plugg backend is unavailable. Please retry later.', 502);
    }
  },
};
