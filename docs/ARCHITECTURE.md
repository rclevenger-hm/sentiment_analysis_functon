# Architecture decisions

## Domain core and cloud boundary

Input, reporting and routing logic reuse the source contract. Azure Functions transport adapts HTTP requests to the domain handler only after Entra verification. Cloud adapters encapsulate Cosmos, Blob, Queue and Language SDKs. Tests inject substitutes without weakening production authentication.

## Cosmos over Table Storage

Job deduplication and quota reservation must commit atomically within one caller partition. Cosmos transactional batches combine job creation with a conditional counter replacement. ETags resolve races between callers and workers. This avoids a quota update succeeding while its corresponding job creation fails, or vice versa.

