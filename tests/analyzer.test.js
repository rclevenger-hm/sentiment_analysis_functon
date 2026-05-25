'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAnalyzer, opinions } = require('../src/analyzer');
const score = (id, extra = {}) => ({ id, sentiment: 'positive', confidenceScores: { positive: 0.98, negative: 0.01, neutral: 0.01 }, sentences: [], ...extra });
test('Azure batches never exceed ten documents and preserve order and stable IDs', async () => {
  const calls = []; const analyzer = createAnalyzer({ async analyzeSentiment(input, options) { calls.push({ input, options }); return input.map((i) => score(i.id)).reverse(); } });
  const records = Array.from({ length: 25 }, (_, i) => ({ id: `row-${i}`, text: 'hello', languageCode: i % 2 ? 'en' : 'fr' }));
  records[5] = { id: 'row-5', error: { code: 'INVALID' } };
  const result = await analyzer.batch(records, true); assert.deepEqual(calls.map((c) => c.input.length), [10, 10, 4]);
  assert.equal(result[5].error.code, 'INVALID'); assert.equal(result[24].id, 'row-24'); assert.equal(result[24].sentiment, 'POSITIVE');
  assert.ok(calls.every((c) => c.options.disableServiceLogs && c.options.stringIndexType === 'Utf16CodeUnit'));
});
test('mixed sentiment does not invent a confidence score absent from Azure', async () => {
  const analyzer = createAnalyzer({ async analyzeSentiment() { return [score('single', { sentiment: 'mixed' })]; } });
  const result = await analyzer.single({ text: 'good and bad', languageCode: 'en' });
  assert.equal(result.sentiment, 'MIXED'); assert.equal(result.sentimentScore.Mixed, undefined);
});
test('per-document errors preserve successful records without leaking provider messages', async () => {
  const analyzer = createAnalyzer({ async analyzeSentiment() { return [score('0'), { id: '1', error: { code: 'InvalidDocument', message: 'secret feedback' } }]; } });
  const result = await analyzer.batch([{ id: 'one', text: 'x' }, { id: 'two', text: 'y' }]);
  assert.equal(result[0].sentiment, 'POSITIVE'); assert.equal(result[1].id, 'two'); assert.ok(result[1].error); assert.doesNotMatch(JSON.stringify(result), /secret feedback/);
});
test('request failures and transient document errors trigger queue retry', async () => {
  const request = createAnalyzer({ async analyzeSentiment() { throw Object.assign(new Error('retry'), { statusCode: 429 }); } });
  await assert.rejects(request.batch([{ text: 'hello' }]), /retry/);
  const document = createAnalyzer({ async analyzeSentiment() { return [{ id: '0', error: { code: 'InternalServerError' } }]; } });
  await assert.rejects(document.batch([{ text: 'hello' }]), /Retryable/);
});
test('missing results and malformed scores become explicit per-record failures', async () => {
  const analyzer = createAnalyzer({ async analyzeSentiment() { return [score('0', { confidenceScores: { positive: NaN } })]; } });
  const results = await analyzer.batch([{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }]);
  assert.ok(results.every((r) => r.error));
});
test('opinion offsets use UTF-16 and evidence remains bounded', () => {
  const target = { text: 'battery', sentiment: 'negative', offset: 3, length: 7, confidenceScores: { positive: 0, negative: 1 } };
  const detail = { sentences: [{ opinions: Array.from({ length: 12 }, () => ({ target, assessments: [{ text: 'bad', sentiment: 'negative', isNegated: false }] })) }] };
  const result = opinions(detail, '😀 battery is bad');
  assert.equal(result.offsetEncoding, 'Utf16CodeUnit'); assert.equal(result.entities.length, 10); assert.ok(result.entitiesTruncated);
  assert.equal('😀 battery is bad'.slice(result.entities[0].mentions[0].beginOffset, result.entities[0].mentions[0].endOffset), 'battery');
});