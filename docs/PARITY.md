# AWS-to-Azure parity

Baseline: `sentiment_analysis_lambda` main at `4c6bd13ea1c52ad016bba56dbf1011d832b76dad` (retrieved October 2026). This compares implemented behavior, not equivalent model accuracy or verified production readiness.

| Capability | Lambda baseline | Azure function |
|---|---|---|
| Single analysis | Comprehend | Azure AI Language |
| Bulk uploads | JSON/CSV, 200 rows, 1 MiB | Same bounds and stable IDs |
| Text limit | 5,000 UTF-8 bytes | Same conservative bound |
| Background processing | 25-record checkpoints | 25-record checkpoints, Azure calls split into at most 10 |
| Invalid records | Individual errors | Individual errors without discarding good rows |
| Targeted insights | English entities and mentions | English aspects and assessments, negation and excerpts |
| Scores | Four confidence values | Three Azure confidence values; no invented Mixed value |
| Identity | IAM role/user | Verified Entra directory/object identity |
| Tenant reads | Partition-scoped | Cosmos partition-scoped; blob URLs scoped by owner |
| Idempotency | Key hash and payload fingerprint | Same semantics with Cosmos transaction |
| Daily quota | Atomic DynamoDB counter | ETag/transaction-protected Cosmos counter |
| Request throttling | Gateway limit | Per-caller atomic minute counter, Flex concurrency/scale ceilings |
| Lease ownership | Conditional checkpoints | Conditional checkpoints plus lease expiry check |
| Result writes | Shared part path | Lease-specific immutable candidates and committed pointers |
| Alert publication | Before checkpoint | Atomic with final checkpoint |
| Recovery | Scheduled scan | Timer with saved continuation cursor |
| History and filters | Caller, status, date | Same; status applies before pagination |
| Reports | Sentiment rates/trends/concerns | Same report logic |
| Comparison | Two finished datasets | Same filters and sample-size caveat |
| Export | 60-second signed S3 link | 60-second HTTPS user-delegation SAS |
| CSV safety | Formula neutralization | Preserved |
| Retention | S3 lifecycle/DynamoDB TTL | Blob lifecycle/Cosmos TTL plus explicit expiry checks |
| Deployment | Terraform/S3 state/OIDC | Terraform/Azure Blob state/OIDC |
| Monitoring | CloudWatch/SNS/Budget | Application Insights/Monitor/action group/budget |

