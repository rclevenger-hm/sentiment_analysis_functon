# Integration

## CLI

Install with `npm ci`, sign in using a permitted consumer identity, and set `API_ENDPOINT` and `ENTRA_AUDIENCE`. `npm run client --` supports analyze, submit, status, results, report, export, history, compare, usage, alerts, rule, and acknowledge. Run without a command for argument help. The client never prints access tokens.

The JavaScript example uses DefaultAzureCredential. The Python example needs `azure-identity`. A browser client should use MSAL authorization code with PKCE, request the API delegated scope, and keep access tokens out of URLs and persistent plain-text storage. Configure allowed CORS origins through Azure platform settings for the intended frontend; no browser UI or broad preflight policy is provisioned.

## Retry policy

Keep one idempotency key for each logical upload. Retry 429 after `Retry-After`, and transient 502/503 with bounded jitter/backoff. A 503 on submit can mean the job already exists but queue dispatch failed. Retry the same payload/key to recover it. Do not generate a new key on every network retry.

Single analysis is not idempotent and can charge accepted allowance again after a retry. Use a one-record job when durable retry semantics matter. Poll status with modest intervals; all requests count toward the caller's minute limit. Keep following cursors in history/alerts.

## Result interpretation

Azure labels and confidence are model outputs, not probabilities calibrated for a particular business use. Mixed sentiment does not have a fourth confidence field. Offset encoding is UTF-16: JavaScript `text.slice(beginOffset,endOffset)` matches the result. Opinion assessments can include `isNegated`.

Use record IDs to connect failures and evidence to upstream systems. Reports use successful analyses as the denominator and expose failed counts. Do not compare rates without reviewing sample counts, sources, date ranges and failure rates. Sentiment is a triage signal, not a definitive judgment about a person.
