# Operations

## Job lifecycle

`QUEUED → RUNNING → QUEUED` checkpoints continue until `COMPLETED` or `COMPLETED_WITH_ERRORS`. A maximum of five failed claims at the same offset produces `FAILED`. Successful checkpoints reset attempts. The queue is at-least-once; completed jobs are no-ops on duplicate delivery.

A claim holds a 180-second lease; function execution is capped at 120 seconds. Queue visibility after failure is 190 seconds. The worker processes 25 records per checkpoint with Azure calls of up to ten documents. Provider request failures throw so Azure retries the message. Input-level failures stay attached to the individual row. A poison-queue handler only fails an exhausted, unleased job; it cannot terminate fresh work.

