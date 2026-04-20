'use strict';
const { HttpError } = require('./input');
const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED', 'A valid Entra access token is required');
function createAuthenticator(config = process.env, verify) {
  const tenant = config.ENTRA_TENANT_ID;
  const audience = config.ENTRA_AUDIENCE;
  if (!tenant || !/^[0-9a-f-]{36}$/i.test(tenant) || !audience) throw new Error('Configure ENTRA_TENANT_ID and ENTRA_AUDIENCE');
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  let keys;
  return async function authenticate(authorization) {
    if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/i.test(authorization) || authorization.length > 16384) throw unauthenticated();
    let payload;
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');
      keys ||= createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
      ({ payload } = await (verify || jwtVerify)(authorization.slice(7), keys, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'tid', 'oid'], clockTolerance: 5 }));
      if (payload.tid !== tenant || typeof payload.oid !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.oid)) throw unauthenticated();
    } catch { throw unauthenticated(); }
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
    if (!roles.includes('Sentiment.User') && !scopes.includes('Sentiment.Access')) throw new HttpError(403, 'FORBIDDEN', 'Sentiment.User role or Sentiment.Access scope required');
    return { tid: payload.tid, oid: payload.oid };
  };
}
module.exports = { createAuthenticator };
