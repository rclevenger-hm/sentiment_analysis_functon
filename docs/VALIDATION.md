# Validation

## Automated checks

`npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=high` run locally or in CI. Terraform uses a checked-in provider lock and mocked-provider tests. CI runs formatting, initialization, validation, and Terraform tests without a live deployment. The production artifact includes locked runtime dependencies.

Infrastructure CI covers the committed provider lock (currently AzureRM 5.11.0) and an explicit 4.81.0 legacy compatibility lane. Only the latter writes a temporary Terraform override and resolves a separate lock in its disposable checkout. Both lanes exercise the secure-default and quota plans, retaining a tested pre-upgrade configuration while validating the new major version. The application checks run once. The legacy lane is not proof that v5-written state can be downgraded, a deployment approval, or a live-state migration test.

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

## Temporary MSAL security pin

`@azure/identity` 4.14.0 still declares MSAL Node `^6.0.0`. A narrowly scoped npm override pins only its `@azure/msal-node` dependency to 7.1.2 because [GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5) affects the authorization-code flow before 7.1.0. No vulnerable version is ignored by the audit gate. Microsoft has [merged the same major-version transition](https://github.com/Azure/azure-sdk-for-js/pull/40532) without Identity authentication implementation changes; its release is not yet available.

Remove this override when a stable Identity release itself requires a patched MSAL Node version (at least 7.1.0), regenerate the lockfile, and rerun these credential tests, audit, build, and production-artifact installation. Reassess the pin before any further Identity upgrade; it is not a permanent substitute for updating the SDK.

The added compatibility tests exercise the installed `DefaultAzureCredential` and MSAL implementations with a strict mock HTTP transport: client-secret and user-assigned App Service managed-identity token success, cache reuse, and failure propagation. Each scenario runs in its own process because MSAL retains managed-identity source configuration globally. Tests use the production credential chain for managed identity, preserving HTTP-option forwarding, and synthetic fixture credentials only. They do not contact Azure or establish live tenant, native-broker, browser sign-in, or resource-permission acceptance. Existing JOSE signature and caller-isolation tests remain in place. The build copies the manifest and lock, including the scoped override, into the production artifact.
