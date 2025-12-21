**Branding deploy checklist**

1) DB quick update (preferred fast path)

Run this SQL against your DB (psql / PGAdmin / Admin UI):

```sql
UPDATE "Branding"
SET "letterheadUrl" = 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg'
WHERE name = 'default';
```

Optional logo:

```sql
UPDATE "Branding"
SET "logoUrl" = 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/logo.png'
WHERE name = 'default';
```

2) Vercel / Env fallback (nice safety net)

Set the following Environment Variables in Vercel (or your hosting env):

- `NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL` = `https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg`
- (optional) `NEXT_PUBLIC_RECEIPT_LOGO_URL` = `https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/logo.png`

3) Redeploy your app

- Push changes (already committed in this repo). Redeploy in Vercel dashboard or run `vercel --prod`.

4) Verify

- Generate a sample receipt HTML: `pnpm ts-node scripts/render-receipt-sample.ts` (writes `tmp/receipt-preview.html`).
- For end-to-end PDF generation: trigger a send or run the worker that produces PDFs. Check logs for `PDF:ok` and `BLOB:ok`.
- Confirm the blob URL loads in the browser and the PDF shows the letterhead.

5) Optional seed

Run `node prisma/seed-branding.ts` after building (or integrate into your seed pipeline).

6) Tag release

`git tag -a v2025.12.21-branding -m "Branding letterhead via absolute blob URL"`
`git push origin v2025.12.21-branding`


If you want, I can try to run the DB SQL (if you provide DB connection) or set Vercel envs (if you provide access token). Otherwise run the above steps in your infra.
