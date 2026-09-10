# Public M-Pesa callback domain

Safaricom must use `https://betech.co.ke`, never `ops.betech.co.ke`.

The apex domain currently has a Vercel-level redirect to `www.betech.co.ke`.
That redirect happens before Next.js can run a rewrite, so the narrowly scoped
Cloudflare Worker in `infrastructure/cloudflare/mpesa-public-proxy` handles
only these four routes and forwards them internally to the existing BetechOps
handlers on `https://www.betech.co.ke`:

- `/api/mpesa/stk/push`
- `/api/mpesa/stk/callback`
- `/api/mpesa/c2b/validation`
- `/api/mpesa/c2b/confirmation`

The Worker preserves the HTTP method, headers, query string and request body.
It does not use, redirect to, or reveal `ops.betech.co.ke`; it also has no
M-Pesa credentials. Every other apex-domain path remains untouched.

## Deployment

From `infrastructure/cloudflare/mpesa-public-proxy`, authenticate an account
that can edit the `betech.co.ke` Cloudflare zone, then run:

```powershell
npx wrangler deploy
```

Do not register any Daraja C2B URLs until the following direct POST probes all
return their backend responses with no `Location` header:

```powershell
curl.exe -i -X POST https://betech.co.ke/api/mpesa/stk/push -H "Content-Type: application/json" --data "{}"
curl.exe -i -X POST https://betech.co.ke/api/mpesa/stk/callback -H "Content-Type: application/json" --data "{}"
curl.exe -i -X POST https://betech.co.ke/api/mpesa/c2b/validation -H "Content-Type: application/json" --data "{}"
curl.exe -i -X POST https://betech.co.ke/api/mpesa/c2b/confirmation -H "Content-Type: application/json" --data "{}"
```
