# Operations

## Job lifecycle

`QUEUED → RUNNING → QUEUED` checkpoints continue until `COMPLETED` or `COMPLETED_WITH_ERRORS`. A maximum of five failed claims at the same offset produces `FAILED`. Successful checkpoints reset attempts. The queue is at-least-once; completed jobs are no-ops on duplicate delivery.

A claim holds a 180-second lease; function execution is capped at 120 seconds. Queue visibility after failure is 190 seconds. The worker processes 25 records per checkpoint with Azure calls of up to ten documents. Provider request failures throw so Azure retries the message. Input-level failures stay attached to the individual row. A poison-queue handler only fails an exhausted, unleased job; it cannot terminate fresh work.

## Atomic output publication

Every worker writes a blob path containing its lease token. Cosmos publishes that pointer only when both lease ownership and expiry checks succeed. Final job status, summary and alert commit together. A failed transaction cannot publish a premature alert, and a stale worker cannot overwrite committed results. Unreferenced input/result/export candidates expire under Blob lifecycle management.

## Recovery

If enqueue fails after the Cosmos transaction, submission may return 503 even though a durable job exists. Retry using the same idempotency key. A five-minute timer scans work stalled for at least fifteen minutes, skipping active leases. It scans at most twenty 100-item pages per run and persists its continuation cursor between runs. Recovery may enqueue duplicates; claims arbitrate them safely. Cosmos expiration filters block stale jobs immediately, before TTL removal.

## Retention

Default metadata and input retention is thirty days. Job metadata contains explicit `expiresAt`; APIs reject expired metadata immediately. Cosmos TTL and Blob lifecycle perform asynchronous physical cleanup. Blobs expire by creation time, so late exports/abandoned candidates can live later than the source job. Lifecycle excludes deployment artifacts. Alert rules also expire after the configured retention from their last update; clients should refresh desired rules.

## Monitoring

Use Application Insights request IDs to correlate responses with structured `request_complete`, `request_error`, `http_error` and `job_progress` events. Submitted text, bearer tokens and raw provider error messages are not logged by the application. Azure Language diagnostic input logging is opted out. SDK/host telemetry should be reviewed against organizational policy.

Monitor HTTP 5xx, function exceptions, poison queue length, queue age and Cosmos throttling. Terraform creates request-error and exception alerts; tune thresholds after real traffic. Query job progress if work appears stalled. Budget and operational notifications are separate from caller sentiment alerts. Sentiment alerts are read and acknowledged through the API.

