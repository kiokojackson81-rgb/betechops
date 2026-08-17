-- Persist the actual route hop that answered an inbound call for sticky return routing.
ALTER TABLE "VoiceCall"
ADD COLUMN "answeredById" TEXT,
ADD COLUMN "answeredNumber" TEXT,
ADD COLUMN "answeredAt" TIMESTAMP(3);

CREATE INDEX "VoiceCall_answeredById_answeredAt_idx" ON "VoiceCall"("answeredById", "answeredAt");
CREATE INDEX "VoiceCall_callerNumber_answeredAt_idx" ON "VoiceCall"("callerNumber", "answeredAt");

ALTER TABLE "VoiceCall"
ADD CONSTRAINT "VoiceCall_answeredById_fkey"
FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill only when the provider payload identifies the bridged destination.
UPDATE "VoiceCall"
SET
  "answeredNumber" = COALESCE(
    NULLIF("rawPayloadJson" ->> 'dialDestinationNumber', ''),
    NULLIF("rawPayloadJson" ->> 'lastDialDestinationNumber', '')
  ),
  "answeredAt" = COALESCE("endedAt", "updatedAt")
WHERE
  "direction" = 'INBOUND'
  AND LOWER("status") IN (
    'answered',
    'connected',
    'completed',
    'complete',
    'successful',
    'success',
    'transferred'
  )
  AND COALESCE(
    NULLIF("rawPayloadJson" ->> 'dialDestinationNumber', ''),
    NULLIF("rawPayloadJson" ->> 'lastDialDestinationNumber', '')
  ) IS NOT NULL;
