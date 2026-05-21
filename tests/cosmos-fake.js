'use strict';
// Stateful Cosmos substitute: conditional writes and batch rollback, not canned responses.
const clone = (v) => v === undefined ? undefined : structuredClone(v);
function cosmosFake() {
  const data = new Map(); const transactions = []; let revision = 0;
  const key = (tenant, id) => `${tenant}:${id}`;
  const error = (code) => Object.assign(new Error(`Cosmos ${code}`), { code });
  const put = (map, tenant, value) => { const next = { ...clone(value), _etag: String(++revision) }; map.set(key(tenant, value.id), next); return clone(next); };
  const container = {
    item(id, tenant) { return {
      async read() { return { resource: clone(data.get(key(tenant, id))) }; },
      async replace(value, options) { const old = data.get(key(tenant, id)); if (!old) throw error(404); if (old._etag !== options.accessCondition.condition) throw error(412); return { resource: put(data, tenant, value) }; },
    }; },
    items: {
      async batch(ops, tenant) {
        transactions.push(clone({ ops, tenant })); const staged = new Map(data);
        for (const op of ops) {
          const body = op.resourceBody; const old = staged.get(key(tenant, body.id));
          if (body.tenantId !== tenant) return { code: 400 };
          if (op.operationType === 'Create' && old) return { code: 409, result: [{ statusCode: 409 }] };
          if (op.operationType === 'Replace' && (!old || old._etag !== op.ifMatch)) return { code: 412, result: [{ statusCode: 412 }] };
          put(staged, tenant, body);
        }
        data.clear(); for (const [k, v] of staged) data.set(k, v);
        return { code: 200, result: ops.map(() => ({ statusCode: 200 })) };
      },
      async upsert(value) { return { resource: put(data, value.tenantId, value) }; },
      query(spec, options) { return { async fetchNext() {
        const p = Object.fromEntries(spec.parameters.map((p) => [p.name, p.value]));
        let rows = [...data.values()].filter((v) => (!p['@tenant'] || v.tenantId === p['@tenant']) && (!p['@collection'] || v.collectionId === p['@collection']) && (!p['@status'] || v.status === p['@status']) && v.expiresAt > p['@now']);
        if (p['@cutoff']) rows = rows.filter((v) => ['QUEUED', 'RUNNING'].includes(v.status) && v.updatedAt < p['@cutoff'] && (!v.leaseUntil || v.leaseUntil <= p['@now']));
        else rows = rows.filter((v) => v.createdAt >= p['@from'] && v.createdAt <= p['@to']);
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const offset = Number(options.continuationToken || 0), end = offset + options.maxItemCount;
        return { resources: clone(rows.slice(offset, end)), continuationToken: end < rows.length ? String(end) : undefined };
      } }; },
    },
  };
  return { container, data, transactions };
}
function blobFake() {
  const objects = new Map();
  const blobs = { accountName: 'test', getContainerClient: () => ({ containerName: 'feedback', getBlockBlobClient: (path) => ({
    url: `https://test.blob.core.windows.net/feedback/${path}`,
    async upload(body) { objects.set(path, String(body)); },
    async downloadToBuffer() { if (!objects.has(path)) throw new Error('Missing blob'); return Buffer.from(objects.get(path)); },
  }) }) };
  return { blobs, objects };
}
module.exports = { cosmosFake, blobFake };
