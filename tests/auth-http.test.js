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