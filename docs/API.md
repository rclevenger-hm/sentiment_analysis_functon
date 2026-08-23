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

