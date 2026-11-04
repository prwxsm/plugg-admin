import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
const request = (path, options) => new Request('https://admin.plugg.site' + path, options);
test('API cannot fall through to SPA or succeed without a backend', async () => {
  const env = { ASSETS: { fetch: () => new Response('SPA') } };
  assert.equal(await (await worker.fetch(request('/admin/staff'), env)).text(), 'SPA');
  assert.equal((await worker.fetch(request('/api/admin/v1/snapshot'), env)).status, 503);
  assert.equal((await worker.fetch(request('/api/upload', { method: 'POST' }), env)).status, 404);
});
test('rejects cross-origin writes before contacting backend', async () => {
  const response = await worker.fetch(request('/api/admin/v1/login', {
    method: 'POST', headers: { origin: 'https://evil.example', 'x-plugg-admin': '1', 'content-type': 'application/json' }, body: '{}',
  }), { PLUGG_BACKEND: { fetch: () => assert.fail('must not call backend') } });
  assert.equal(response.status, 403);
});
test('forwards session, body and origin, preserves cookies, and disables caching', async () => {
  const response = await worker.fetch(request('/api/admin/v1/login', {
    method: 'POST', headers: { origin: 'https://admin.plugg.site', 'x-plugg-admin': '1', 'content-type': 'application/json', cookie: 'other=private; plugg_session=session-id' }, body: '{"identifier":"test"}',
  }), { PLUGG_BACKEND: { async fetch(req) {
    assert.equal(req.headers.get('cookie'), 'plugg_session=session-id');
    assert.equal(req.headers.get('origin'), 'https://admin.plugg.site');
    assert.equal(await req.text(), '{"identifier":"test"}');
    return new Response('{}', { headers: { 'Set-Cookie': 'plugg_session=new; HttpOnly; Secure; Path=/', 'Cache-Control': 'public' } });
  } } });
  assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('media range response and unavailable backend stay distinct', async () => {
  const response = await worker.fetch(request('/api/stream/audio%2Ftest.opus', { headers: { Range: 'bytes=0-2' } }), {
    PLUGG_BACKEND: { async fetch(req) {
      assert.equal(req.headers.get('range'), 'bytes=0-2');
      return new Response('abc', { status: 206, headers: { 'Content-Range': 'bytes 0-2/9' } });
    } },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-2/9');
  assert.equal((await worker.fetch(request('/api/admin/v1/snapshot'), { PLUGG_BACKEND: { fetch() { throw Error('private connection detail'); } } })).status, 502);
});
test('HTTPS Node gateway pins host and preserves body, origin and secure cookie', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async req => {
    assert.equal(req.url, 'https://plugg-test.onrender.com/api/admin/v1/login');
    assert.equal(req.headers.get('origin'), 'https://admin.plugg.site');
    assert.equal(req.headers.get('authorization'), null);
    assert.equal(req.headers.get('cookie'), 'plugg_session=abc');
    assert.equal(req.redirect, 'manual');
    assert.equal(await req.text(), '{}');
    return new Response('{}', { headers: {'Set-Cookie': 'plugg_session=new; HttpOnly; Secure; Path=/'} });
  };
  try {
    const response = await worker.fetch(request('/api/admin/v1/login', {
      method: 'POST', headers: { origin: 'https://admin.plugg.site', 'x-plugg-admin': '1', 'content-type': 'application/json', cookie: 'other=private; plugg_session=abc', authorization: 'unrelated' }, body: '{}',
    }), { PLUGG_BACKEND_ORIGIN: 'https://plugg-test.onrender.com' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly; Secure/);
  } finally { globalThis.fetch = original; }
});
test('Node gateway rejects insecure or non-origin configuration', async () => {
  for (const origin of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?x=1']) {
    assert.equal((await worker.fetch(request('/api/admin/v1/snapshot'), {PLUGG_BACKEND_ORIGIN:origin})).status, 503);
  }
});
