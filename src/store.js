'use strict';
const { randomUUID } = require('node:crypto');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient, BlobSASPermissions, SASProtocol, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const { QueueClient } = require('@azure/storage-queue');
const { HttpError, invalid, hash } = require('./input');
const final = (s) => ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(s);
const conflict = (e) => [409, 412].includes(Number(e?.code || e?.statusCode || e?.cause?.code || e?.cause?.statusCode));
const clean = (v) => JSON.parse(JSON.stringify(v, (k, x) => k.startsWith('_') ? undefined : x));
const notFound = () => new HttpError(404, 'NOT_FOUND', 'Resource not found');
const quotaError = () => new HttpError(429, 'DAILY_LIMIT_EXCEEDED', 'Daily analysis allowance exceeded; resets at 00:00 UTC');
function createStore({ container, blobs, queue, config = process.env, clock = () => new Date() } = {}) {
  const credential = (!container || !blobs || !queue) ? new DefaultAzureCredential() : null;
  container ||= new CosmosClient({ endpoint: config.COSMOS_ENDPOINT, aadCredentials: credential }).database(config.COSMOS_DATABASE || 'sentiment').container('items');
  blobs ||= new BlobServiceClient(config.BLOB_ENDPOINT, credential);
  queue ||= new QueueClient(`${config.QUEUE_ENDPOINT}/sentiment-jobs`, credential);
  const bucket = blobs.getContainerClient(config.DATA_CONTAINER || 'feedback');
  const retention = Number(config.DATA_RETENTION_DAYS || 30);
  const quota = Number(config.DAILY_ANALYSIS_LIMIT || 1000);
  const rate = Number(config.REQUESTS_PER_MINUTE || 60);
  if (!Number.isInteger(rate) || rate < 1 || !Number.isInteger(quota) || quota < 1 || !Number.isInteger(retention) || retention < 1) throw new Error('Invalid quota/retention configuration');
  const now = () => Math.floor(clock().getTime() / 1000);
  const id = (key) => hash(key); // Cosmos IDs cannot contain '/', '\\', '?' or '#'.
  const ref = (tenant, key) => container.item(id(key), tenant);
  const raw = async (tenant, key) => { try { return (await ref(tenant, key).read()).resource || null; } catch (e) { if (Number(e.code) === 404) return null; throw e; } };
  const doc = (value) => ({ ...clean(value), id: id(value.key), ttl: Math.max(1, (value.expiresAt || now() + retention * 86400) - now()) });
  const retry = async (fn) => {
    for (let i = 0; i < 8; i++) { try { return await fn(); } catch (e) { if (!conflict(e)) throw e; } }
    throw new HttpError(503, 'WRITE_CONTENTION', 'Concurrent update; retry the request');
  };
  const usageKey = () => `USAGE#${clock().toISOString().slice(0, 10)}`;
  const usageOperation = (tenantId, units, previous, key) => {
    if (!Number.isInteger(units) || units < 0 || (previous?.units || 0) + units > quota) throw quotaError();
    const resourceBody = doc({ tenantId, key, units: (previous?.units || 0) + units, expiresAt: now() + 3 * 86400 });
    return previous ? { operationType: 'Replace', id: previous.id, resourceBody, ifMatch: previous._etag } : { operationType: 'Create', resourceBody };
  };
  const batch = async (tenant, ops) => {
    const result = await container.items.batch(ops, tenant);
    const statuses = [result.code, ...(result.result || []).map((r) => r.statusCode)].map(Number);
    if (statuses.some((s) => s >= 400)) {
      const code = statuses.find((s) => [409, 412].includes(s)) || statuses.find((s) => s >= 400 && s !== 424) || 503;
      throw Object.assign(new Error('Cosmos transaction rejected'), { code });
    }
    return result;
  };
  const mutate = (tenant, key, change) => retry(async () => {
    const old = await raw(tenant, key);
    if (!old || old.expiresAt <= now()) throw notFound();
    const next = change(old); if (!next) return null;
    await ref(tenant, key).replace(doc(next), { accessCondition: { type: 'IfMatch', condition: old._etag } });
    return next;
  });
  const store = {
    expiry: () => now() + retention * 86400,
    async putObject(path, value) { const body = JSON.stringify(value); await bucket.getBlockBlobClient(path).upload(body, Buffer.byteLength(body), { blobHTTPHeaders: { blobContentType: 'application/json' } }); },
  };
  return store;
}