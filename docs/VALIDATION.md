# Validation

## Automated checks

`npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=high` run locally or in CI. Terraform uses a checked-in provider lock and mocked-provider tests. CI runs formatting, initialization, validation, and Terraform tests without a live deployment. The production artifact includes locked runtime dependencies.

Behavioral coverage includes malformed/null input, UTF-8 and CSV bounds, JWT signatures/issuer/audience/expiry, role/scope checks, tenant isolation, report/export semantics, duplicate keys, atomic quota contention, per-minute limits, lease expiry/replacement, terminal retries, bounded Azure batches, poison-message safeguards and recovery pagination.

Cosmos tests implement transactional rollback and ETag conflicts in a stateful substitute. These tests validate application invariants, not the Azure service itself. Local environments that block provider sockets cannot run Terraform validation; CI performs that gate on a normal GitHub runner.

## Live acceptance checklist

Before marking a deployment production-ready:

- Deploy twice using the same remote backend; second plan must be empty.
- Confirm authorized token success and wrong-tenant/audience/permission denial.
- Submit and poll CSV/JSON, including invalid rows and multilingual text.
- Verify opinion source offsets against real emoji-containing responses.
- Concurrently submit duplicate keys and quota-boundary requests.
- Verify Blob SAS read-only behavior and expiry after sixty seconds.
- Perform worker/queue/recovery failure drills in staging.
- Confirm Cosmos TTL and Blob lifecycle physically remove expired data.
- Confirm operational and budget emails arrive.
- Redeploy a prior artifact and verify rollback without replacing data.

`npm run smoke` covers a subset and is intentionally not run without a configured Azure endpoint/identity. It creates retained sample data and invokes a billable model. No live Azure subscription was assumed during repository creation.
