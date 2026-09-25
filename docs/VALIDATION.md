# Validation

## Automated checks

`npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=high` run locally or in CI. Terraform uses a checked-in provider lock and mocked-provider tests. CI runs formatting, initialization, validation, and Terraform tests without a live deployment. The production artifact includes locked runtime dependencies.

Behavioral coverage includes malformed/null input, UTF-8 and CSV bounds, JWT signatures/issuer/audience/expiry, role/scope checks, tenant isolation, report/export semantics, duplicate keys, atomic quota contention, per-minute limits, lease expiry/replacement, terminal retries, bounded Azure batches, poison-message safeguards and recovery pagination.

Cosmos tests implement transactional rollback and ETag conflicts in a stateful substitute. These tests validate application invariants, not the Azure service itself. Local environments that block provider sockets cannot run Terraform validation; CI performs that gate on a normal GitHub runner.

