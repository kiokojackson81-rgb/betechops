/*
Mint an admin JWT locally.

Usage (PowerShell):
  $env:JWT_SECRET = "your-jwt-secret"
  node .\scripts\mint-admin-token.js --userId cmadmin000000000000 --roles ADMIN,SUPERVISOR --expiresIn 1h

If you don't have `jsonwebtoken`, install it once: `npm i jsonwebtoken` (or `pnpm add jsonwebtoken`).

Notes:
- This script signs an HS256 token. Ensure your app verifies JWTs using the same secret and algorithm.
- Do NOT paste your JWT_SECRET here. Run locally where the secret exists.
*/

const jwt = require('jsonwebtoken');
const argv = require('minimist')(process.argv.slice(2));

const secret = process.env.JWT_SECRET || argv.jwtSecret;
if (!secret) {
  console.error('Missing JWT secret. Provide via env JWT_SECRET or --jwtSecret <secret>');
  process.exit(2);
}

const userId = argv.userId || 'cm-admin-000000000000';
const rolesArg = argv.roles || 'ADMIN';
const roles = rolesArg.split(',').map(r => r.trim()).filter(Boolean);
const expiresIn = argv.expiresIn || '1h';

const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: userId,
  roles,
  iat: now,
};

const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
console.log(token);
