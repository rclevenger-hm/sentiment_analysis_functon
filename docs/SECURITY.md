# Security boundaries

## Authentication and ownership

Tokens are cryptographically verified against a fixed tenant JWKS endpoint, issuer, audience and algorithm. Authorization requires a scope or role. The partition key is SHA-256 of the verified directory/object pair, never a client parameter. Every job, report, export, comparison, history and alert route uses this key. Job IDs alone grant no access.

App-level tenant isolation is between individual Entra principals; group members do not automatically share data. Changing consumer service principal/object ID creates a different data scope. Federation and resource identities do not establish caller sharing.

## Private data

Azure Storage public blob access and shared keys are disabled. Cosmos local keys and Language API keys are disabled. TLS is required. Export links use read-only, HTTPS user-delegation SAS with a sixty-second lifetime and a single blob path. Anyone holding that link can download until expiry, so treat it as a temporary credential. Content is encrypted at rest by Azure's default service encryption; customer-managed encryption keys are not configured.

## Input and output

Bodies are capped while streaming; decoding rejects malformed UTF-8. CSV is parsed with quoting rules and row limits. JSON types, language codes, IDs and dates are validated. Formula-prefixed exported CSV cells are neutralized. Report evidence is bounded and is not a generated explanation of user intent.

## Limits

Daily reservations and per-minute request counters use Cosmos optimistic concurrency. Both have bounded retries; backend failures fail closed. Function concurrency and maximum instance count bound scale but are not dollar-denominated spending caps. A dedicated frontend gateway/WAF can provide IP controls and pre-authentication DDoS filtering; this repository does not provision one.

