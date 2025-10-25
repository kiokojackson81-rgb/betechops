Jumia Vendor API — How to add env vars to Vercel and trigger a redeploy

Security first
- If you accidentally shared a refresh token in a public place, revoke/rotate it immediately in the Jumia Vendor portal.
- Do not paste the old token into code, commits, or public chats.

Required environment variables (Production)
- base_url=https://vendor-api.jumia.com  # preferred canonical env name
- (legacy) JUMIA_API_BASE=https://vendor-api.jumia.com  # supported but prefer `base_url`
- OIDC_ISSUER or JUMIA_OIDC_ISSUER=https://vendor-api.jumia.com/auth/realms/acl
- OIDC_CLIENT_ID or JUMIA_CLIENT_ID=e6eca268-6f02-4db0-90d2-dc4cab0f265b
- OIDC_REFRESH_TOKEN or JUMIA_REFRESH_TOKEN=<PASTE_NEW_REFRESH_TOKEN_HERE>
- (optional) JUMIA_OIDC_TOKEN_URL or OIDC_TOKEN_URL=https://vendor-api.jumia.com/protocol/openid-connect/token

How to add via Vercel UI
1. Open: https://vercel.com
2. Select your project ("betechops" or appropriate project under your account).
3. Settings → Environment Variables
4. Add the four variables above. Set the Environment to "Production" (or both Production & Preview if you want previews to use them).
5. Click "Save" for each variable.
6. Once saved, trigger a redeploy by either:
   - Visiting Deployments → click "Redeploy" on the latest production deployment, or
   - Make a tiny commit (e.g., update README or add an empty commit) and push.

How to add via Vercel CLI
(Requires Vercel CLI installed and authenticated)

1. Install (if needed):
   npm i -g vercel
2. Login:
   vercel login
3. Set a production variable (repeat per variable):
   vercel env add JUMIA_OIDC_ISSUER production
   # when prompted, paste: https://vendor-api.jumia.com/auth/realms/acl

   vercel env add JUMIA_CLIENT_ID production
   # paste: e6eca268-6f02-4db0-90d2-dc4cab0f265b

   vercel env add JUMIA_REFRESH_TOKEN production
   # paste: <PASTE_NEW_REFRESH_TOKEN_HERE>

   vercel env add base_url production
   # paste: https://vendor-api.jumia.com

4. Redeploy by creating an empty commit and pushing:
   git commit --allow-empty -m "chore: trigger redeploy with new Jumia creds"
   git push origin branch-3

Notes
- Use Production scope for the live site. If you want preview environments to have these values too, add them under "Preview" or "Development" as appropriate.
- Do NOT commit secrets to git.
- After redeploy, confirm the endpoints that rely on Jumia return live responses.

If you'd like, I can:
- Push the empty commit to this branch for you once you confirm you've rotated the token and updated Vercel (I won't include the token in git).
- Or generate the exact CLI commands to run locally in PowerShell (safe to paste the token into the interactive CLI prompts).