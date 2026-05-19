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