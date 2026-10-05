-- Customer-facing POD support must use the One Voice/mobile routing line,
-- never a staff member's personal phone number.
UPDATE "User"
SET "oneVoiceCustomerNumber" = CASE
  WHEN "name" ILIKE '%brendah%' THEN '+254716722601'
  WHEN "name" ILIKE '%jennifer%' OR "name" ILIKE '%jeniffer%' THEN '+254703241917'
  WHEN "name" ILIKE '%stephen%' THEN '+254180970066'
  ELSE COALESCE(
    NULLIF(BTRIM("notificationPhoneNumber"), ''),
    NULLIF(BTRIM("mobileMoneyPhoneNumber"), '')
  )
END
WHERE
  ("role" IN ('ADMIN', 'SUPERVISOR', 'ATTENDANT') OR "attendantCategory" IS NOT NULL)
  AND NULLIF(BTRIM(COALESCE("oneVoiceCustomerNumber", '')), '') IS NULL;
