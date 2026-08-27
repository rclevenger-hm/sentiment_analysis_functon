# Architecture decisions

## Domain core and cloud boundary

Input, reporting and routing logic reuse the source contract. Azure Functions transport adapts HTTP requests to the domain handler only after Entra verification. Cloud adapters encapsulate Cosmos, Blob, Queue and Language SDKs. Tests inject substitutes without weakening production authentication.

