# Deployment

The workflow is manual and incurs Azure charges. A GitHub code push does not deploy infrastructure.

## Prerequisites

Azure subscription, Entra/OIDC registrations from [IDENTITY.md](IDENTITY.md), Terraform 1.13.5, Node.js 24, and a region supporting Flex Consumption, Language, and serverless Cosmos. Verify `node 24` availability using `az functionapp list-runtimes` for the target subscription/region. Use globally unique `name` and an isolated environment resource group.

## Remote state

Create a dedicated StorageV2 account and private `tfstate` container outside this stack. Require TLS 1.2, disable public blobs, use Entra access, enable blob versioning and soft delete, and assign the deployment identity Blob Data Contributor. State locking uses Azure blob leases. Do not create the state account inside a stack it is supposed to preserve.

Copy `terraform/backend.hcl.example` to a private local file and `terraform/terraform.tfvars.example` to an ignored `.tfvars` file. Set the first day of the actual deployment month for `budget_start_date`.

```bash
terraform -chdir=terraform init -backend-config=backend.hcl
terraform -chdir=terraform plan -out=deploy.tfplan
terraform -chdir=terraform apply deploy.tfplan
```

For an existing deployment, initialize against its existing remote state or run `terraform import` for existing resources. Never apply a fresh empty state over an existing environment. Separate state keys and resource names for dev/stage/prod.

## AzureRM provider compatibility

The committed provider constraint is AzureRM `~> 5.11`, with the lock on 5.11.0. CI also validates the configuration with the previous 4.81.0 provider in a disposable checkout to retain a tested pre-upgrade migration path. Merging this source change does not apply it to deployed infrastructure. Cosmos explicitly sets `local_authentication_enabled = false`, preserving Entra-only access. Both queues use the existing storage account's ARM ID, retaining their names, Terraform addresses, and runtime managed-identity connections.

The [4.81 queue documentation](https://github.com/hashicorp/terraform-provider-azurerm/blob/v4.81.0/website/docs/r/storage_queue.html.markdown) supports changing the same account from name to ID without recreating a queue. Queue management then uses ARM rather than the data-plane API. Before applying to an existing environment, back up remote state and inspect an authenticated plan. Stop if it proposes replacing either queue or re-enabling local authentication; mocked tests cannot verify live resource preservation or permissions.

Review the [v5 upgrade guide](https://github.com/hashicorp/terraform-provider-azurerm/blob/v5.11.0/website/docs/guides/5.0-upgrade-guide.html.markdown) before applying the provider upgrade. Version 5.11 includes migration of legacy queue state, but old AzureAD-created queue IDs can require a subscription-wide storage-account lookup, beyond the resource-group scope described in [IDENTITY.md](IDENTITY.md). If that lookup is denied, have an operator review migration using the prior 4.81 lock from before this upgrade or import using verified ARM IDs; do not remove/recreate queues or blindly edit state. Also verify required Azure resource providers are registered, because v5 no longer registers them automatically by default. No live-state migration is proven by CI. The legacy CI lane does not establish that state already written by v5 can be downgraded; use the reviewed state backup and recovery procedure instead.

## GitHub environment variables

| Variable | Value |
|---|---|
| `AZURE_CLIENT_ID` | Federated deployment application client ID |
| `AZURE_TENANT_ID` | Directory GUID |
| `AZURE_SUBSCRIPTION_ID` | Subscription GUID |
| `SERVICE_NAME` | Globally unique lowercase name, 5–17 characters |
| `AZURE_LOCATION` | Supported Azure region |
| `ENTRA_AUDIENCE` | API registration client GUID |
| `NOTIFICATION_EMAIL` | Operator email |
| `BUDGET_START_DATE` | First of deployment month, UTC ISO format |
| `MONTHLY_BUDGET` | Optional, defaults to 100 in billing currency |
| `TF_STATE_RESOURCE_GROUP` | State account resource group |
| `TF_STATE_STORAGE_ACCOUNT` | State account name |

Dispatch **Deploy Azure**, selecting the matching protected environment. The job tests/builds code, initializes OIDC remote state, applies a saved plan, then deploys the complete artifact with Azure/functions-action using Flex OneDeploy. Production node modules are installed into the artifact; no remote build is assumed. Do not add `WEBSITE_RUN_FROM_PACKAGE` or legacy deployment settings to Flex.

## Local Functions host

For cloud-connected local work install Azure Functions Core Tools v4, copy `local.settings.json.example` to ignored `local.settings.json`, populate endpoints, and run `npm run build && npm start`. For developer credentials remove explicit `__credential=managedidentity`/`__clientId` host/queue settings and use the Core Tools identity connection support with your signed-in principal. Grant your developer identity only the needed data roles. Unit tests need neither Core Tools nor cloud endpoints.

## After deployment

Wait for managed-identity role propagation, then run `npm run smoke` with an authorized consumer identity and the endpoint/audience set. It submits billable sample records, verifies anonymous rejection, duplicate submission, partial errors, reports, and CSV download. Run the remaining [live validation checklist](VALIDATION.md) before advertising production readiness.

## Rollback

Rebuild and redeploy the previous tested source commit through the same OIDC deployment path. Review the Terraform plan before applying any infrastructure rollback; never replace Cosmos/storage just to roll back function code. Preserve state backups and data. Stop queue processing before incompatible data migrations. There is no destructive reset or automatic destroy workflow.
