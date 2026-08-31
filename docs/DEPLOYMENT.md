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

