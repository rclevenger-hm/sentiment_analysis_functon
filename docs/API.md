# API contract

Base URL: `https://FUNCTION.azurewebsites.net/api`. All routes require `Authorization: Bearer TOKEN`. Tokens need the API audience, configured directory, and `Sentiment.User` role or `Sentiment.Access` delegated scope. Caller-supplied tenant/principal headers have no authority.

## Routes

| Method | Path | Behavior |
|---|---|---|
| POST | `/analyze-sentiment` | Synchronous analysis; no retained text history |
| POST | `/jobs` | Submit JSON/CSV; requires `Idempotency-Key` |
| GET | `/jobs/{id}` | Status, progress and retention expiry |
| GET | `/jobs/{id}/results` | Filtered records; `offset` and `limit` |
| GET | `/jobs/{id}/report` | Counts, negative rate, daily trends, aspect evidence |
| GET | `/jobs/{id}/export` | `format=json` or `csv`; signed download link |
| GET | `/history` | Caller jobs; `status`, dates, `limit`, `cursor` |
| GET | `/compare` | `current` and `baseline` finished job IDs |
| GET | `/usage` | Daily accepted units and reset time |
| GET/PUT | `/alert-rule` | Read/replace one caller rule |
| GET | `/alerts` | Caller alert feed with cursor |
| PUT | `/alerts/{jobId}/acknowledge` | Idempotent acknowledgement |

## Submit

```json
{"label":"September reviews","targeted":true,"records":[
  {"id":"ticket-123","text":"Great screen, poor battery.","languageCode":"en","date":"2026-09-30","product":"phone","source":"support"}
]}
```

`POST /jobs` accepts `Content-Type: application/json` or `text/csv`. CSV columns: `id,text,languageCode,date,product,source`; only text is required. Quoting, embedded newlines, UTF-8 BOM and escaped quotes are supported. For CSV opinion mining use `?targeted=true`. Single input uses `{text,languageCode,targeted}`.

Bounds: 1 MiB decoded body; 200 records; 5,000 UTF-8 bytes per trimmed text; 120-character labels/product/source; 128-character record IDs. Missing IDs become `row-N`. Duplicate IDs reject the whole upload. Invalid individual text/metadata returns a retained row error. Unsupported content types return 415.

## Filters and pagination

Results/reports/exports/comparison accept `sentiment`, `minConfidence`, `languageCode`, `source`, `product`, `from`, and `to`. Dates are validated `YYYY-MM-DD`; absent record dates use submission date. Rates use successfully analyzed records. Comparison changes describe samples and do not establish statistical significance.

Result limits: 1–100, default 50; offsets: 0–200. History/feed limits: 1–100, default 20. A cursor belongs to its caller, collection and filter set. Keep following `nextCursor` even if a page is empty. Partial job reports include committed records only; failed jobs include explicit errors for unprocessed rows.

## Response and errors

Single responses expose `sentiment`, `sentimentScore.Positive/Negative/Neutral`, and optional `entities`, `entitiesTruncated`, `offsetEncoding`, `modelVersion`. `MIXED` is a valid label without a Mixed score. Opinion evidence is capped at ten aspects and three assessments per aspect.

Every application error has `code`, `error`, and `requestId`. Codes include `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `EXPIRED_KEY`, `DAILY_LIMIT_EXCEEDED`, `RATE_LIMIT_EXCEEDED`, `UPSTREAM_UNAVAILABLE`, and `SERVICE_UNAVAILABLE`. Infrastructure-level failures can have an Azure-managed body. Responses include `x-request-id` and `Cache-Control: no-store`; 429 includes `Retry-After`.

A job submission returns 202 while unfinished and 200 when a matching job already finished. Reusing a key with changed normalized content returns 409. Keys are 8–128 ASCII letters/digits/dot/underscore/colon/hyphen. Expired keys still awaiting Cosmos TTL deletion return `EXPIRED_KEY`; choose a new key.

