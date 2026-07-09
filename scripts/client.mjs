import { DefaultAzureCredential } from '@azure/identity';
const credential = new DefaultAzureCredential();
export async function request(path, { method = 'GET', body, contentType = 'application/json', idempotencyKey } = {}) {
  const endpoint = process.env.API_ENDPOINT;
  if (!endpoint || !process.env.ENTRA_AUDIENCE) throw new Error('Set API_ENDPOINT and ENTRA_AUDIENCE');
  const base = new URL(endpoint);
  if (base.protocol !== 'https:') throw new Error('API_ENDPOINT must use HTTPS');
  const url = new URL(`${base.pathname.replace(/\/$/, '')}${path}`, base.origin);
  const token = await credential.getToken(`api://${process.env.ENTRA_AUDIENCE}/.default`);
  if (!token) throw new Error('No Azure token available; run az login or configure workload identity');
  const response = await fetch(url, { method, body, headers: { authorization: `Bearer ${token.token}`, 'content-type': contentType, ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) }, signal: AbortSignal.timeout(35000), redirect: 'error' });
  const text = await response.text();
  if (!response.ok) {
    let code; try { code = JSON.parse(text).code; } catch { code = 'REQUEST_FAILED'; }
    throw new Error(`${response.status} ${code}; request ${response.headers.get('x-request-id') || 'unknown'}`);
  }
  return { text, contentType: response.headers.get('content-type') };
}
