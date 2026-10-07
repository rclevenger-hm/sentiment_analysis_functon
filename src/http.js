'use strict';
const { randomUUID } = require('node:crypto');
const { HttpError, MAX_REQUEST_BYTES } = require('./input');
async function readBody(request) {
  const chunks = []; let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new HttpError(413, 'REQUEST_TOO_LARGE', 'Request body exceeds 1 MiB'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be valid UTF-8'); }
}
function createHttpAdapter({ authenticate, handler, logger = console }) {
  return async (request, context = {}) => {
    const requestId = context.invocationId || randomUUID();
    try {
      const identity = await authenticate(request.headers.get('authorization'));
      const body = await readBody(request);
      const path = `/${request.params.path || ''}`;
      const response = await handler({ httpMethod: request.method, path, headers: Object.fromEntries(request.headers), body,
        queryStringParameters: Object.fromEntries(new URL(request.url).searchParams), requestContext: { requestId, identity } }, context);
      return { status: response.statusCode, headers: response.headers, body: response.body };
    } catch (error) {
      const known = error instanceof HttpError;
      logger.error(JSON.stringify({ event: 'http_error', requestId, errorName: error.name }));
      return { status: known ? error.status : 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-request-id': requestId },
        jsonBody: { code: known ? error.code : 'SERVICE_UNAVAILABLE', error: known ? error.message : 'Service temporarily unavailable', requestId } };
    }
  };
}
module.exports = { createHttpAdapter, readBody };
