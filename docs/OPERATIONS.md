# Operations

## Job lifecycle

`QUEUED → RUNNING → QUEUED` checkpoints continue until `COMPLETED` or `COMPLETED_WITH_ERRORS`. A maximum of five failed claims at the same offset produces `FAILED`. Successful checkpoints reset attempts. The queue is at-least-once; completed jobs are no-ops on duplicate delivery.

A claim holds a 180-second lease; function execution is capped at 120 seconds. Queue visibility after failure is 190 seconds. The worker processes 25 records per checkpoint with Azure calls of up to ten documents. Provider request failures throw so Azure retries the message. Input-level failures stay attached to the individual row. A poison-queue handler only fails an exhausted, unleased job; it cannot terminate fresh work.

## Atomic output publication

Every worker writes a blob path containing its lease token. Cosmos publishes that pointer only when both lease ownership and expiry checks succeed. Final job status, summary and alert commit together. A failed transaction cannot publish a premature alert, and a stale worker cannot overwrite committed results. Unreferenced input/result/export candidates expire under Blob lifecycle management.

## Recovery

If enqueue fails after the Cosmos transaction, submission may return 503 even though a durable job exists. Retry using the same idempotency key. A five-minute timer scans work stalled for at least fifteen minutes, skipping active leases. It scans at most twenty 100-item pages per run and persists its continuation cursor between runs. Recovery may enqueue duplicates; claims arbitrate them safely. Cosmos expiration filters block stale jobs immediately, before TTL removal.

