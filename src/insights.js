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