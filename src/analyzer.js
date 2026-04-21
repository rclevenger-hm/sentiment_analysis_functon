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