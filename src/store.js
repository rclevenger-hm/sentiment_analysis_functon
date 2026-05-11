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
    async getObject(path) { return JSON.parse((await bucket.getBlockBlobClient(path).downloadToBuffer()).toString('utf8')); },
    async exportFile(path, content, format) {
      const blob = bucket.getBlockBlobClient(path);
      await blob.upload(content, Buffer.byteLength(content), { blobHTTPHeaders: { blobContentType: format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json', blobContentDisposition: `attachment; filename="sentiment-results.${format}"` } });
      const startsOn = new Date(clock().getTime() - 60000), expiresOn = new Date(clock().getTime() + 60000);
      const key = await blobs.getUserDelegationKey(startsOn, expiresOn);
      const sas = generateBlobSASQueryParameters({ containerName: bucket.containerName, blobName: path, permissions: BlobSASPermissions.parse('r'), startsOn, expiresOn, protocol: SASProtocol.Https }, key, blobs.accountName).toString();
      return `${blob.url}?${sas}`;
    },
    async get(tenant, key) { const value = await raw(tenant, key); return value && (!value.expiresAt || value.expiresAt > now()) ? value : null; },
    async getJob(tenant, jobId) { const value = await store.get(tenant, `JOB#${jobId}`); if (!value) throw notFound(); return value; },
    async reserveRequest(tenant) {
      const key = `RATE#${clock().toISOString().slice(0, 16)}`;
      const limit = rate;
      return retry(async () => {
        const old = await raw(tenant, key);
        if ((old?.units || 0) >= limit) throw new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Request rate exceeded; retry in one minute');
        const resourceBody = doc({ tenantId: tenant, key, units: (old?.units || 0) + 1, expiresAt: now() + 120 });
        await batch(tenant, [old ? { operationType: 'Replace', id: old.id, resourceBody, ifMatch: old._etag } : { operationType: 'Create', resourceBody }]);
      });
    },
    async reserveUsage(tenant, units) { const key = usageKey(); return retry(async () => batch(tenant, [usageOperation(tenant, units, await raw(tenant, key), key)])); },
    async createJob(job, units) {
      const key = usageKey();
      return retry(async () => {
        const old = await raw(job.tenantId, job.key);
        if (old) {
          if (old.expiresAt <= now()) throw new HttpError(409, 'EXPIRED_KEY', 'Use a new Idempotency-Key');
          return { job: old, created: false };
        }
        const operation = usageOperation(job.tenantId, units, await raw(job.tenantId, key), key);
        await batch(job.tenantId, [{ operationType: 'Create', resourceBody: doc({ ...job, parts: [] }) }, operation]);
        return { job: { ...job, parts: [] }, created: true };
      });
    },
    async enqueue(tenantId, jobId) { await queue.sendMessage(JSON.stringify({ tenantId, jobId }), { messageTimeToLive: 86400 }); },
    async claim(tenant, jobId) {
      try {
        return await mutate(tenant, `JOB#${jobId}`, (job) => {
          if (final(job.status) || job.leaseUntil > now()) return null;
          if ((job.attempts || 0) >= 5) return { ...job, status: 'FAILED', failureReason: 'Worker retry limit exceeded. Completed records remain available.', updatedAt: clock().toISOString() };
          return { ...job, status: 'RUNNING', attempts: (job.attempts || 0) + 1, leaseToken: randomUUID(), leaseUntil: now() + 180, updatedAt: clock().toISOString() };
        }).then((job) => job?.status === 'RUNNING' ? job : null);
      } catch (e) { if (e.status === 404) return null; throw e; }
    },
    async checkpoint(job, offset, summary, part, alert) {
      return retry(async () => {
        const current = await raw(job.tenantId, job.key);
        if (!current || current.status !== 'RUNNING' || current.expiresAt <= now() || current.leaseUntil <= now() || current.leaseToken !== job.leaseToken || current.offset !== job.offset) throw new HttpError(409, 'LEASE_LOST', 'Worker lease expired');
        const next = { ...current, offset, parts: [...(current.parts || []), part], status: summary ? (summary.failed || summary.insightFailures ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED') : 'QUEUED', updatedAt: clock().toISOString(), ...(summary ? { summary } : {}) };
        delete next.leaseToken; delete next.leaseUntil; delete next.attempts;
        const ops = [{ operationType: 'Replace', id: current.id, resourceBody: doc(next), ifMatch: current._etag }];
        if (alert) ops.push({ operationType: 'Create', resourceBody: doc({ tenantId: job.tenantId, key: `ALERT#${job.jobId}`, collectionId: `${job.tenantId}#alerts`, jobId: job.jobId, alert, acknowledged: false, createdAt: clock().toISOString(), expiresAt: job.expiresAt }) });
        await batch(job.tenantId, ops);
      });
    },
    async fail(tenant, jobId) {
      try { await mutate(tenant, `JOB#${jobId}`, (job) => final(job.status) || job.leaseUntil > now() || (job.attempts || 0) < 5 ? null : { ...job, status: 'FAILED', failureReason: 'Worker retry limit exceeded. Completed records remain available.', updatedAt: clock().toISOString() }); }
      catch (e) { if (e.status !== 404) throw e; }
    },
    async results(job) {
      const records = (await Promise.all((job.parts || []).map((p) => store.getObject(p)))).flat();
      if (job.status === 'FAILED' && job.offset < job.total) {
        const input = await store.getObject(job.inputKey);
        records.push(...input.records.slice(job.offset).map((r) => ({ ...r, error: r.error || { code: 'JOB_FAILED', message: 'Retry limit exceeded before this record completed' } })));
      }
      return records;
    },
    async list(tenant, collection, { limit = 20, cursor, from, to, status } = {}) {
      const signature = hash(JSON.stringify({ tenant, collection, from, to, status }));
      let continuationToken;
      if (cursor) {
        try {
          if (cursor.length > 16000) throw invalid('Invalid cursor');
          const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
          if (value.signature !== signature || typeof value.token !== 'string') throw invalid('Invalid cursor');
          continuationToken = value.token;
        } catch { throw invalid('Invalid cursor'); }
      }
      const parameters = [{ name: '@tenant', value: tenant }, { name: '@collection', value: `${tenant}#${collection}` }, { name: '@now', value: now() }, { name: '@from', value: from ? `${from}T00:00:00.000Z` : '0000' }, { name: '@to', value: to ? `${to}T23:59:59.999Z` : '9999' }];
      if (status) parameters.push({ name: '@status', value: status });
      const query = `SELECT * FROM c WHERE c.tenantId = @tenant AND c.collectionId = @collection AND c.expiresAt > @now AND c.createdAt >= @from AND c.createdAt <= @to${status ? ' AND c.status = @status' : ''} ORDER BY c.createdAt DESC`;
      const page = await container.items.query({ query, parameters }, { partitionKey: tenant, maxItemCount: limit, continuationToken }).fetchNext();
      return { items: page.resources, nextCursor: page.continuationToken ? Buffer.from(JSON.stringify({ signature, token: page.continuationToken })).toString('base64url') : null };
    },
    async putRule(tenantId, rule) { await container.items.upsert(doc({ tenantId, key: 'RULE#default', rule, expiresAt: store.expiry() })); },
    async acknowledge(tenant, jobId) { await mutate(tenant, `ALERT#${jobId}`, (value) => ({ ...value, acknowledged: true })); },
    async usage(tenant) { const date = clock().toISOString().slice(0, 10); const value = await store.get(tenant, `USAGE#${date}`); return { date, units: value?.units || 0, limit: quota, unit: 'accepted inference operations; targeted analysis counts twice', resetsAt: new Date(Date.parse(date) + 86400000).toISOString() }; },
    async saveRecoveryCursor(cursor) { await container.items.upsert(doc({ tenantId: 'system-recovery', key: 'RECOVERY#cursor', cursor: cursor || null, expiresAt: store.expiry() })); },
  };
  return store;
}