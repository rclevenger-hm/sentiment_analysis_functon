# Costs and bounds

Provisioned services include Flex Consumption compute, Azure AI Language, serverless Cosmos, Storage queues/blobs, and Application Insights/Log Analytics. Exact pricing depends on region, model metering and subscription; consult Azure pricing before deployment. This repository makes no free-tier guarantee.

Default application limits are 1,000 accepted analysis units per principal per UTC day and 60 API requests per minute. Targeted requests reserve two units for compatibility. These units do not map exactly to Azure text-record billing or retry charges. Changing the role assignment to many principals increases aggregate allowance.

Flex uses 2,048 MiB instances, HTTP concurrency four, and a default maximum of forty instances. Scale bounds do not guarantee spending limits. Queue workers process one message per instance at a time. Cosmos reads for quotas and retained history also incur usage. Recovery scans old jobs and should be profiled as retained volume increases.

Terraform provisions a resource-group monthly budget with 80% actual and 100% forecast notifications. A budget sends notifications; it does not shut off inference. Log Analytics has a one-GB daily ingestion quota. Tighten limits and evaluate alarms in staging before opening broad access.

Retention defaults to thirty days. Exports and abandoned candidates are included in cleanup, while deployment blobs are excluded. Review artifact accumulation and subscription costs periodically. Budget-start date must match the actual deployment month rather than any Git commit date.
