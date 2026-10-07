"""Requires azure-identity. Uses the same Entra API registration as the CLI."""
import json
import os
import urllib.request
from azure.identity import DefaultAzureCredential

endpoint = os.environ['API_ENDPOINT'].rstrip('/')
if not endpoint.startswith('https://'):
    raise ValueError('API_ENDPOINT must use HTTPS')
token = DefaultAzureCredential().get_token(f"api://{os.environ['ENTRA_AUDIENCE']}/.default")
request = urllib.request.Request(
    f'{endpoint}/analyze-sentiment',
    data=json.dumps({'text': 'A useful product.', 'targeted': False}).encode(),
    headers={'Authorization': f'Bearer {token.token}', 'Content-Type': 'application/json'},
    method='POST',
)
with urllib.request.urlopen(request, timeout=35) as response:
    print(json.load(response))
