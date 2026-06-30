-- Add admin-managed voice routing controls.
CREATE TABLE "VoiceAgentRoutingPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "routingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "allowAfterHoursCalls" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceAgentRoutingPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceRoutingConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL DEFAULT 'default',
  "overflowUserId" TEXT,
  "overflowPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceRoutingConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoiceAgentRoutingPreference_userId_key" ON "VoiceAgentRoutingPreference"("userId");
CREATE INDEX "VoiceAgentRoutingPreference_routingEnabled_allowAfterHoursCalls_idx" ON "VoiceAgentRoutingPreference"("routingEnabled", "allowAfterHoursCalls");
CREATE UNIQUE INDEX "VoiceRoutingConfig_key_key" ON "VoiceRoutingConfig"("key");
CREATE INDEX "VoiceRoutingConfig_overflowUserId_idx" ON "VoiceRoutingConfig"("overflowUserId");

ALTER TABLE "VoiceAgentRoutingPreference"
ADD CONSTRAINT "VoiceAgentRoutingPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoiceRoutingConfig"
ADD CONSTRAINT "VoiceRoutingConfig_overflowUserId_fkey"
FOREIGN KEY ("overflowUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
