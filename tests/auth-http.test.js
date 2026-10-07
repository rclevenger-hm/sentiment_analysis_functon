'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthenticator } = require('../src/auth');
const { createHttpAdapter } = require('../src/http');
const { HttpError } = require('../src/input');
const config = { ENTRA_TENANT_ID: '11111111-1111-1111-1111-111111111111', ENTRA_AUDIENCE: '22222222-2222-2222-2222-222222222222' };
const oid = '33333333-3333-3333-3333-333333333333';
const issuer = `https://login.microsoftonline.com/${config.ENTRA_TENANT_ID}/v2.0`;
async function signer() {
  const jose = await import('jose'); const keys = await jose.generateKeyPair('RS256');
  const token = async (claims = {}, options = {}) => new jose.SignJWT({ tid: config.ENTRA_TENANT_ID, oid, roles: ['Sentiment.User'], ...claims }).setProtectedHeader({ alg: 'RS256' }).setIssuer(options.issuer || issuer).setAudience(options.audience || config.ENTRA_AUDIENCE).setIssuedAt().setExpirationTime(options.exp || '5m').sign(keys.privateKey);
  const auth = createAuthenticator(config, (token, _keys, options) => jose.jwtVerify(token, keys.publicKey, options));
  return { token, auth, jose };
}
test('Entra authenticator verifies a real signed token and scopes by directory/object IDs', async () => {
  const f = await signer(); assert.deepEqual(await f.auth(`Bearer ${await f.token()}`), { tid: config.ENTRA_TENANT_ID, oid });
});
for (const [label, claims, options] of [
  ['expired', {}, { exp: 1 }], ['wrong issuer', {}, { issuer: 'https://attacker.example' }], ['wrong audience', {}, { audience: 'other-api' }],
  ['wrong directory', { tid: 'other' }, {}], ['missing object', { oid: null }, {}],
]) test(`Entra rejects ${label} tokens`, async () => { const f = await signer(); await assert.rejects(f.auth(`Bearer ${await f.token(claims, options)}`), (e) => e.status === 401); });
test('tokens without permission receive 403; delegated scopes are accepted', async () => {
  const f = await signer(); await assert.rejects(f.auth(`Bearer ${await f.token({ roles: [] })}`), (e) => e.status === 403);
  assert.equal((await f.auth(`Bearer ${await f.token({ roles: [], scp: 'Sentiment.Access' })}`)).oid, oid);
});
test('modified signatures and unsigned tokens cannot authenticate', async () => {
  const f = await signer(); const signed = await f.token(); const parts = signed.split('.'); parts[1] = Buffer.from(JSON.stringify({ tid: config.ENTRA_TENANT_ID, oid, roles: ['Sentiment.User'] })).toString('base64url');
  await assert.rejects(f.auth(`Bearer ${parts.join('.')}`), (e) => e.status === 401);
  await assert.rejects(f.auth('Bearer eyJhbGciOiJub25lIn0.e30.'), (e) => e.status === 401);
});
test('missing, malformed and oversized authorization headers are rejected', async () => {
  const auth = createAuthenticator(config);
  for (const header of [undefined, '', 'Basic password', 'Bearer a b', `Bearer ${'a'.repeat(20000)}`]) await assert.rejects(auth(header), (e) => e.status === 401);
});
function request(body = '{}', headers = {}) { const native = new Request('https://example.test/api/jobs?limit=3', { method: 'POST', body, headers }); return Object.assign(native, { params: { path: 'jobs' } }); }
const logger = { error() {} };
test('HTTP boundary authenticates before body reads and never trusts principal headers', async () => {
  let called = false;
  const adapter = createHttpAdapter({ authenticate: async () => { throw new HttpError(401, 'UNAUTHENTICATED', 'Token required'); }, handler: async () => { called = true; }, logger });
  const result = await adapter(request('{bad', { 'x-ms-client-principal': 'forged' }), { invocationId: 'correlation' });
  assert.equal(result.status, 401); assert.equal(called, false); assert.equal(result.headers['x-request-id'], 'correlation');
});
test('HTTP adapter preserves CSV bodies, filters and verified identity', async () => {
  let seen;
  const adapter = createHttpAdapter({ authenticate: async () => ({ tid: 'directory', oid: 'principal' }), handler: async (event) => { seen = event; return { statusCode: 202, headers: { location: '/jobs/one' }, body: '{}' }; }, logger });
  const result = await adapter(request('text\nhello', { 'content-type': 'text/csv' }));
  assert.equal(result.status, 202); assert.equal(seen.body, 'text\nhello'); assert.equal(seen.queryStringParameters.limit, '3'); assert.equal(seen.requestContext.identity.oid, 'principal');
});
test('HTTP body is bounded while streaming and invalid UTF-8 is rejected', async () => {
  const adapter = createHttpAdapter({ authenticate: async () => ({}), handler: async () => { throw new Error('must not reach core'); }, logger });
  assert.equal((await adapter(request('a'.repeat(1024 * 1024 + 1)))).status, 413);
  assert.equal((await adapter(request(new Uint8Array([255])))).status, 400);
});
test('unexpected HTTP adapter failures hide upstream details', async () => {
  const adapter = createHttpAdapter({ authenticate: async () => { throw new Error('secret endpoint and credential'); }, handler: async () => {}, logger });
  const result = await adapter(request()); assert.equal(result.status, 503); assert.doesNotMatch(JSON.stringify(result), /secret endpoint/);
});
