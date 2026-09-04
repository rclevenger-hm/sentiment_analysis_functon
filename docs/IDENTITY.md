# Entra and GitHub OIDC setup

## API registration

Create a single-tenant Entra application dedicated to this API. Set its Application ID URI to `api://CLIENT_GUID` and its manifest `api.requestedAccessTokenVersion` to `2`. Terraform variable `entra_audience` is the raw application client GUID used by v2 access tokens. `entra_tenant_id` is the directory GUID.

Expose delegated scope `Sentiment.Access`, and create application role `Sentiment.User` with allowed member types `Application` and/or `User` according to your consumer policy. Assign the role to authorized service principals/users; grant admin consent for client application permissions. Delegated clients need consent for the scope. Do not use the deployment identity as an application consumer by default.

The CLI requests `api://CLIENT_GUID/.default` using DefaultAzureCredential. For interactive Azure CLI credentials, authorize the Azure CLI client on the API scope or use a separately configured client credential/workload identity with the application role. Being signed into Azure alone does not grant API access.

JWT validation pins tenant-specific issuer/JWKS, audience and RS256. It requires expiration, issuance time, directory/object claims, then checks permission. `x-ms-client-principal`, `x-tenant-id` and similar request headers are ignored. `authLevel: anonymous` means the Functions key mechanism is disabled; application JWT authentication still runs before any body processing or data access.

## Runtime identity

Terraform creates a dedicated user-assigned managed identity with:

- Cosmos built-in data contributor at the service database scope.
- Cognitive Services User on the dedicated Language resource.
- Storage Blob Data Owner, Storage Queue Data Contributor and Storage Account Contributor on the dedicated host/data storage account for Functions host, triggers, deployment and delegated SAS operations.

No storage/Cosmos/Language keys are enabled. Runtime credentials do not grant access to unrelated resources. Storage Account Contributor is a host requirement for this configuration; keep the account dedicated and do not place unrelated data there.

