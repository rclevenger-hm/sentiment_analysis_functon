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

