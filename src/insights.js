'use strict';

const { invalid, dateOnly, object } = require('./input');
const SENTIMENTS = new Set(['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED']);

function filtersFrom(query = {}) {
  const filters = {};
  if (query.sentiment !== undefined) {
    if (!SENTIMENTS.has(query.sentiment)) throw invalid('Invalid sentiment filter');
    filters.sentiment = query.sentiment;
  }
  for (const key of ['product', 'source', 'languageCode']) if (query[key] !== undefined) {
    if (typeof query[key] !== 'string' || query[key].length > 120) throw invalid(`Invalid ${key} filter`);
    filters[key] = query[key];
  }
  for (const key of ['from', 'to']) if (query[key] !== undefined) filters[key] = dateOnly(query[key]);
  if (filters.from && filters.to && filters.from > filters.to) throw invalid('from must be before to');
  if (query.minConfidence !== undefined) {
    const value = Number(query.minConfidence);
    if (query.minConfidence === '' || !Number.isFinite(value) || value < 0 || value > 1) throw invalid('minConfidence must be between 0 and 1');
    filters.minConfidence = value;
  }
  return filters;
}

function confidence(record) { return record.sentimentScore?.[record.sentiment?.[0] + record.sentiment?.slice(1).toLowerCase()] ?? 0; }
function filterResults(records, filters = {}, fallbackDate) {
  return records.filter((record) => {
    for (const key of ['product', 'source', 'languageCode', 'sentiment']) if (filters[key] !== undefined && record[key] !== filters[key]) return false;
    const date = record.date || fallbackDate;
    if (filters.from && (!date || date < filters.from)) return false;
    if (filters.to && (!date || date > filters.to)) return false;
    if (filters.minConfidence !== undefined && confidence(record) < filters.minConfidence) return false;
    return true;
  });
}

function summarize(records, fallbackDate) {
  const counts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 };
  const days = new Map(); const concerns = new Map();
  let failed = 0; let insightFailures = 0;
  for (const record of records) {
    if (!SENTIMENTS.has(record.sentiment)) { failed++; continue; }
    counts[record.sentiment]++;
    if (record.insightsError) insightFailures++;
    const day = record.date || fallbackDate;
    const trend = days.get(day) || { date: day, total: 0, negative: 0 };
    trend.total++; trend.negative += Number(record.sentiment === 'NEGATIVE'); days.set(day, trend);
    const seen = new Set();
    for (const entity of record.entities || []) for (const mention of entity.mentions) {
      const key = mention.text.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const concern = concerns.get(key) || { text: mention.text, records: 0, negative: 0, evidence: [] };
      concern.records++; concern.negative += Number(mention.sentiment === 'NEGATIVE');
      if (concern.evidence.length < 3) concern.evidence.push({ recordId: record.id, sentiment: mention.sentiment, excerpt: mention.excerpt });
      concerns.set(key, concern);
    }
  }
  const analyzed = records.length - failed;
  return {
    total: records.length, analyzed, failed, insightFailures, counts,
    negativeRate: analyzed ? counts.NEGATIVE / analyzed : null,
    trends: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({ ...day, negativeRate: day.negative / day.total })),
    concerns: [...concerns.values()].sort((a, b) => b.negative - a.negative || b.records - a.records).slice(0, 30),
  };
}

function compare(current, baseline) {
  return { current, baseline, analyzedChange: current.analyzed - baseline.analyzed,
    negativeRateChange: current.negativeRate === null || baseline.negativeRate === null ? null : current.negativeRate - baseline.negativeRate,
    note: 'Rates use successfully analyzed records. Differences describe these samples; they do not establish statistical significance.' };
}