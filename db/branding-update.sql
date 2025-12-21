-- Update branding to use absolute Vercel Blob URLs for letterhead and logo
-- Run this against your Postgres (or the DB your app uses)

UPDATE "Branding"
SET "letterheadUrl" = 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/letterhead.png.jpg'
WHERE name = 'default';

-- Optional: set absolute logo URL if you have one
-- UPDATE "Branding"
-- SET "logoUrl" = 'https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/logo.png'
-- WHERE name = 'default';

-- Quick check
-- SELECT name, "letterheadUrl", "logoUrl" FROM "Branding" WHERE name = 'default';
