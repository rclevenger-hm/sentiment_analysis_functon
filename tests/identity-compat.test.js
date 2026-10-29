const { spawnSync } = require('node:child_process');
const test = require('node:test');

// MSAL caches managed-identity source configuration process-wide. Isolate each
// credential scenario so environment selection and token caches cannot leak.
function credentialTest(name, body) {
  const selected = process.argv[2];
  if (selected) {
    if (selected === name) test(name, body);
    return;
  }
  test(name, () => {
    const result = spawnSync(process.execPath, [__filename, name], {
      encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.status, 0, result.stdout + result.stderr + (result.error || ''));
  });
}

const assert = require('node:assert/strict');
const { DefaultAzureCredential } = require('@azure/identity');
const { createHttpHeaders } = require('@azure/core-rest-pipeline');

const tenant = '00000000-0000-0000-0000-000000000001';
const client = '00000000-0000-0000-0000-000000000002';
const scope = 'https://cognitiveservices.azure.com/.default';
const envNames = ['AZURE_TOKEN_CREDENTIALS', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_CLIENT_CERTIFICATE_PATH', 'AZURE_FEDERATED_TOKEN_FILE', 'IDENTITY_ENDPOINT', 'IDENTITY_HEADER', 'IDENTITY_SERVER_THUMBPRINT', 'IMDS_ENDPOINT', 'MSI_ENDPOINT', 'MSI_SECRET'];

function environment(t, values) {
  const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  Object.assign(process.env, values);
  t.after(() => {
    for (const name of envNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}

function response(request, status, body) {
  return { request, status, headers: createHttpHeaders({ 'content-type': 'application/json' }), bodyAsText: JSON.stringify(body) };
}

function confidentialTransport(fail = false) {
  const tokenRequests = [];
  return {
    tokenRequests,
    async sendRequest(request) {
      const url = new URL(request.url);
      assert.equal(url.origin, 'https://login.microsoftonline.com');
      if (url.pathname === '/common/discovery/instance') {
        return response(request, 200, { tenant_discovery_endpoint: `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`, metadata: [{ preferred_network: 'login.microsoftonline.com', preferred_cache: 'login.windows.net', aliases: ['login.microsoftonline.com', 'login.windows.net', 'sts.windows.net'] }] });
      }
      if (url.pathname.endsWith('/v2.0/.well-known/openid-configuration')) {
        return response(request, 200, { authorization_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`, token_endpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, issuer: `https://login.microsoftonline.com/${tenant}/v2.0`, jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys' });
      }
      assert.equal(url.pathname, `/${tenant}/oauth2/v2.0/token`);
      assert.equal(request.method, 'POST');
      const params = new URLSearchParams(request.body);
      assert.equal(params.get('grant_type'), 'client_credentials');
      assert.equal(params.get('client_id'), client);
      assert.equal(params.get('client_secret'), 'fixture-secret-not-a-credential');
      assert.equal(params.get('scope'), scope);
      tokenRequests.push(request);
      return fail
        ? response(request, 401, { error: 'invalid_client', error_description: 'Fixture credential rejected' })
        : response(request, 200, { token_type: 'Bearer', expires_in: 3600, ext_expires_in: 3600, access_token: 'fixture-client-token' });
    }
  };
}

credentialTest('DefaultAzureCredential client-secret flow obtains and caches a token through the installed MSAL adapter', async t => {
  environment(t, { AZURE_TOKEN_CREDENTIALS: 'EnvironmentCredential', AZURE_TENANT_ID: tenant, AZURE_CLIENT_ID: client, AZURE_CLIENT_SECRET: 'fixture-secret-not-a-credential' });
  const httpClient = confidentialTransport();
  const credential = new DefaultAzureCredential({ httpClient, retryOptions: { maxRetries: 0 } });
  const token = await credential.getToken(scope);
  assert.equal(token.token, 'fixture-client-token');
  assert.ok(token.expiresOnTimestamp > Date.now());
  assert.equal((await credential.getToken(scope)).token, token.token);
  assert.equal(httpClient.tokenRequests.length, 1);
});

credentialTest('DefaultAzureCredential client-secret flow preserves authentication failure', async t => {
  environment(t, { AZURE_TOKEN_CREDENTIALS: 'EnvironmentCredential', AZURE_TENANT_ID: tenant, AZURE_CLIENT_ID: client, AZURE_CLIENT_SECRET: 'fixture-secret-not-a-credential' });
  const httpClient = confidentialTransport(true);
  const credential = new DefaultAzureCredential({ httpClient, retryOptions: { maxRetries: 0 } });
  await assert.rejects(credential.getToken(scope), /invalid_client|Fixture credential rejected/);
  assert.equal(httpClient.tokenRequests.length, 1);
});

function managedTransport(fail = false, identityId = client) {
  const requests = [];
  return {
    requests,
    async sendRequest(request) {
      const url = new URL(request.url);
      assert.equal(url.origin + url.pathname, 'http://localhost:40342/identity/token');
      assert.equal(request.method, 'GET');
      assert.equal(request.headers.get('x-identity-header'), 'fixture-identity-header');
      assert.equal(url.searchParams.get('resource'), 'https://cognitiveservices.azure.com');
      assert.equal(url.searchParams.get('client_id'), identityId);
      requests.push(request);
      return fail
        ? response(request, 400, { error: 'invalid_request', error_description: 'Fixture identity unavailable' })
        : response(request, 200, { access_token: 'fixture-managed-token', expires_on: String(Math.floor(Date.now() / 1000) + 3600), resource: 'https://cognitiveservices.azure.com', token_type: 'Bearer', client_id: client });
    }
  };
}

credentialTest('DefaultAzureCredential user-assigned App Service identity obtains and caches a token', async t => {
  environment(t, { AZURE_TOKEN_CREDENTIALS: 'prod', AZURE_CLIENT_ID: client, IDENTITY_ENDPOINT: 'http://localhost:40342/identity/token', IDENTITY_HEADER: 'fixture-identity-header' });
  const httpClient = managedTransport();
  const credential = new DefaultAzureCredential({ httpClient, retryOptions: { maxRetries: 0 } });
  const token = await credential.getToken(scope);
  assert.equal(token.token, 'fixture-managed-token');
  assert.ok(token.expiresOnTimestamp > Date.now());
  assert.equal((await credential.getToken(scope)).token, token.token);
  assert.equal(httpClient.requests.length, 1);
});

credentialTest('DefaultAzureCredential user-assigned App Service identity preserves token-service failure', async t => {
  const rejectedClient = '00000000-0000-0000-0000-000000000003';
  environment(t, { AZURE_TOKEN_CREDENTIALS: 'prod', AZURE_CLIENT_ID: rejectedClient, IDENTITY_ENDPOINT: 'http://localhost:40342/identity/token', IDENTITY_HEADER: 'fixture-identity-header' });
  const httpClient = managedTransport(true, rejectedClient);
  const credential = new DefaultAzureCredential({ httpClient, retryOptions: { maxRetries: 0 } });
  await assert.rejects(credential.getToken(scope), error => error.name === 'AggregateAuthenticationError' && /ManagedIdentityCredential/.test(error.message));
  assert.equal(httpClient.requests.length, 1);
});
