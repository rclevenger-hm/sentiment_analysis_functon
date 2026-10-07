# Roadmap

## Release acceptance

Complete the live checks in VALIDATION.md: repeated deployment, identity propagation, real opinion output, recovery injection, notification delivery and rollback. Keep release claims limited until evidence is recorded.

## Next improvements

1. Validate multilingual opinion mining and expose supported languages by model version.
2. Add private endpoint/VNet deployment profiles with stricter host/data separation.
3. Add a browser review dashboard using Entra PKCE and constrained CORS.
4. Add job cancellation with a cooperative worker state transition and explicit billing semantics.
5. Add webhook delivery with signing, destination policy, retries and an auditable delivery feed.
6. Add organization-level shared workspaces with explicit role-based sharing.
7. Replace broad recovery scans with indexed dispatch/outbox scheduling when workload requires it.
8. Benchmark model quality against representative labeled feedback; expose calibration and failure-rate reports.

These are planned features, not implemented product capabilities.
