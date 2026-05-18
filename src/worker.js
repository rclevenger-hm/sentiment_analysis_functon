'use strict';
const { summarize, evaluateRule } = require('./insights');
function message(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (!/^[a-f0-9]{64}$/.test(data?.tenantId || '') || !/^[a-f0-9]{64}$/.test(data?.jobId || '')) throw new Error('Invalid queue message');
  return data;
}
function createWorker({ store, analyzer, logger = console }) {
  async function processJob(value) {
    const { tenantId, jobId } = message(value);
    const job = await store.claim(tenantId, jobId);
    if (!job) return;
    const input = await store.getObject(job.inputKey);
    const records = input.records.slice(job.offset, job.offset + 25);
    if (!records.length || job.total !== input.records.length) throw new Error('Invalid job input');
    const results = await analyzer.batch(records, job.targeted);
    if (results.length !== records.length) throw new Error('Incomplete batch');
    // Stale workers can write only their own immutable candidate, never a winning result.
    const part = `${tenantId}/jobs/${jobId}/part-${job.offset}-${job.leaseToken}.json`;
    await store.putObject(part, results);
    const offset = job.offset + records.length;
    let summary, alert;
    if (offset === job.total) {
      const complete = [...await store.results(job), ...results];
      summary = summarize(complete, job.createdAt.slice(0, 10));
      const rule = (await store.get(tenantId, 'RULE#default'))?.rule;
      alert = evaluateRule(rule, complete, job.createdAt.slice(0, 10));
    }
    // The part pointer, completed state and alert commit in one tenant transaction.
    await store.checkpoint(job, offset, summary, part, alert);
    if (!summary) await store.enqueue(tenantId, jobId);
    logger.info(JSON.stringify({ event: 'job_progress', jobId, processed: offset, total: job.total }));
  }
  async function recover() {
    // Resume scans across timer runs so a busy partition cannot starve later pages.
    const system = 'system-recovery';
    const checkpoint = await store.get(system, 'RECOVERY#cursor');
    let cursor = checkpoint?.cursor;
    for (let page = 0; page < 20; page++) {
      cursor = await store.recover(cursor);
      await store.saveRecoveryCursor(cursor);
      if (!cursor) break;
    }
  }
  return { processJob, recover, async poison(value) { const { tenantId, jobId } = message(value); await store.fail(tenantId, jobId); } };
}
module.exports = { createWorker, message };
