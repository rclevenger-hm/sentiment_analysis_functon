# Integration

## CLI

Install with `npm ci`, sign in using a permitted consumer identity, and set `API_ENDPOINT` and `ENTRA_AUDIENCE`. `npm run client --` supports analyze, submit, status, results, report, export, history, compare, usage, alerts, rule, and acknowledge. Run without a command for argument help. The client never prints access tokens.

The JavaScript example uses DefaultAzureCredential. The Python example needs `azure-identity`. A browser client should use MSAL authorization code with PKCE, request the API delegated scope, and keep access tokens out of URLs and persistent plain-text storage. Configure allowed CORS origins through Azure platform settings for the intended frontend; no browser UI or broad preflight policy is provisioned.

