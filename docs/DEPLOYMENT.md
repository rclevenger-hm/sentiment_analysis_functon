# Deployment

The workflow is manual and incurs Azure charges. A GitHub code push does not deploy infrastructure.

## Prerequisites

Azure subscription, Entra/OIDC registrations from [IDENTITY.md](IDENTITY.md), Terraform 1.13.5, Node.js 24, and a region supporting Flex Consumption, Language, and serverless Cosmos. Verify `node 24` availability using `az functionapp list-runtimes` for the target subscription/region. Use globally unique `name` and an isolated environment resource group.

