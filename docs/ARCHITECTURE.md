# Architecture decisions

## Domain core and cloud boundary

Input, reporting and routing logic reuse the source contract. Azure Functions transport adapts HTTP requests to the domain handler only after Entra verification. Cloud adapters encapsulate Cosmos, Blob, Queue and Language SDKs. Tests inject substitutes without weakening production authentication.

## Cosmos over Table Storage

Job deduplication and quota reservation must commit atomically within one caller partition. Cosmos transactional batches combine job creation with a conditional counter replacement. ETags resolve races between callers and workers. This avoids a quota update succeeding while its corresponding job creation fails, or vice versa.

## Immutable candidates

A blob upload cannot join a Cosmos transaction. Each lease therefore gets its own candidate path. Only the committed Cosmos pointer makes a candidate visible in results. Old workers can leave storage objects but cannot replace a winning pointer. Final alerts share the checkpoint transaction.

## Queue with durable recovery

Queue dispatch cannot join the Cosmos transaction either. The persisted `QUEUED` job acts as the durable record of accepted work. A timer repairs missing dispatches with a paged recovery scan. This is at-least-once processing with idempotent commits; Azure Language inference may run more than once.

