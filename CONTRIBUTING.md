# Contributing

Use Node.js 24 and the committed dependency lock. Run lint, tests and build before proposing a change. Infrastructure changes need formatting, validation and Terraform tests. Add behavior tests for changed authentication, quotas, ownership, retries or retention. Never commit local.settings.json, credentials, Terraform state, customer feedback or signed export links.

Keep Azure adapters separate from input/report logic. Do not remove source attribution. Document model-contract differences explicitly rather than manufacturing fields. For changes affecting lease/checkpoint behavior, exercise concurrent and stale-worker cases before deployment.
