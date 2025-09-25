Auth & Deployment notes
======================

This project uses NextAuth for Google SSO. To enable authentication and make the post-login routing work, configure the following environment variables in your deployment (Vercel) and locally in a .env file:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXTAUTH_SECRET (a random string)
- ADMIN_EMAIL (the admin account email, e.g. kiokojackson81@gmail.com)

On Vercel
---------
1. Open your project in the Vercel dashboard.
2. Go to Settings → Environment Variables.
3. Add the variables above for Production (and Preview/Development if needed).

Locally
-------
Create a `.env.local` with the same variables for local testing.

Notes
-----
- If you update environment variables on Vercel, trigger a redeploy (push a small commit or redeploy from the dashboard).
- Make sure the Google OAuth consent and authorized redirect URIs are configured to include the Vercel and localhost callback URLs: `https://<your-vercel-domain>/.auth/` and `http://localhost:3000` as appropriate.
