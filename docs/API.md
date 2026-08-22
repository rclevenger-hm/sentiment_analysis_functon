# API contract

Base URL: `https://FUNCTION.azurewebsites.net/api`. All routes require `Authorization: Bearer TOKEN`. Tokens need the API audience, configured directory, and `Sentiment.User` role or `Sentiment.Access` delegated scope. Caller-supplied tenant/principal headers have no authority.

