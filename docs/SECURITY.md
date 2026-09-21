# Security boundaries

## Authentication and ownership

Tokens are cryptographically verified against a fixed tenant JWKS endpoint, issuer, audience and algorithm. Authorization requires a scope or role. The partition key is SHA-256 of the verified directory/object pair, never a client parameter. Every job, report, export, comparison, history and alert route uses this key. Job IDs alone grant no access.

App-level tenant isolation is between individual Entra principals; group members do not automatically share data. Changing consumer service principal/object ID creates a different data scope. Federation and resource identities do not establish caller sharing.

