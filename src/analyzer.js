'use strict';
const { TextAnalyticsClient } = require('@azure/ai-text-analytics');
const { DefaultAzureCredential } = require('@azure/identity');
const { SENTIMENTS } = require('./insights');
const transient = (e) => [408, 429].includes(Number(e?.statusCode)) || Number(e?.statusCode) >= 500 || /TooManyRequests|Internal|Unavailable|Timeout|Abort|ECONN|ETIMEDOUT/i.test(e?.code || e?.name || '');
const language = (code) => code === 'zh-TW' ? 'zh-hant' : code;
const safeError = () => ({ code: 'ANALYSIS_FAILED', message: 'Analysis could not be completed for this record' });
function scores(value) {
  const sentiment = value?.sentiment?.toUpperCase();
  const s = value?.confidenceScores;
  if (!SENTIMENTS.has(sentiment) || !s || !['positive', 'negative', 'neutral'].every((k) => Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1)) throw new Error('Malformed upstream result');
  // Azure has no mixed confidence score; never invent one to mimic Comprehend.
  return { sentiment, sentimentScore: { Positive: s.positive, Negative: s.negative, Neutral: s.neutral }, modelVersion: value.modelVersion };
}
function opinions(result, text) {
  const all = (result.sentences || []).flatMap((sentence) => sentence.opinions || []);
  return { entities: all.slice(0, 10).map((opinion) => ({ mentions: [{
    text: opinion.target.text.slice(0, 160), type: 'ASPECT', sentiment: opinion.target.sentiment.toUpperCase(),
    sentimentScore: { Positive: opinion.target.confidenceScores.positive, Negative: opinion.target.confidenceScores.negative },
    beginOffset: opinion.target.offset, endOffset: opinion.target.offset + opinion.target.length,
    excerpt: text.slice(Math.max(0, opinion.target.offset - 40), opinion.target.offset + opinion.target.length + 40).slice(0, 240),
    assessments: (opinion.assessments || []).slice(0, 3).map((a) => ({ text: a.text.slice(0, 160), sentiment: a.sentiment.toUpperCase(), isNegated: a.isNegated })),
  }], truncated: (opinion.assessments || []).length > 3 })), entitiesTruncated: all.length > 10, offsetEncoding: 'Utf16CodeUnit' };
}
function createAnalyzer(client, config = process.env) {
  client ||= new TextAnalyticsClient(config.LANGUAGE_ENDPOINT, new DefaultAzureCredential(), { retryOptions: { maxRetries: 2 }, allowInsecureConnection: false });
  const options = (targeted) => ({ includeOpinionMining: targeted, stringIndexType: 'Utf16CodeUnit', disableServiceLogs: true, abortSignal: AbortSignal.timeout(25000) });
  return {
    async single(record, targeted = false) {
      const response = await client.analyzeSentiment([{ id: 'single', text: record.text, language: language(record.languageCode) }], options(targeted));
      const result = response[0];
      if (!result || result.error) throw new Error('Analysis failed');
      return { ...scores(result), modelVersion: response.modelVersion, ...(targeted ? opinions(result, record.text) : {}) };
    },
    async batch(records, targeted = false) {
      const output = records.map((r) => ({ ...r }));
      const indices = records.flatMap((r, i) => r.error ? [] : [i]);
      // Azure synchronous sentiment accepts ten documents per request.
      for (let offset = 0; offset < indices.length; offset += 10) {
        const group = indices.slice(offset, offset + 10);
        const input = group.map((i) => ({ id: String(i), text: records[i].text, language: language(records[i].languageCode) }));
        // Request-level failures (including auth/configuration) must retry, not mark all rows invalid.
        const response = await client.analyzeSentiment(input, options(targeted));
        const results = new Map(response.map((r) => [r.id, r]));
        for (const i of group) {
          const value = results.get(String(i));
          if (value?.error && transient(value.error)) throw Object.assign(new Error('Retryable document failure'), value.error);
          try {
            if (!value || value.error) output[i].error = safeError();
            else Object.assign(output[i], scores(value), { modelVersion: response.modelVersion }, targeted ? opinions(value, records[i].text) : {});
          } catch { output[i].error = safeError(); }
        }
      }
      return output;
    },
  };
}
module.exports = { createAnalyzer, transient, scores, opinions };
