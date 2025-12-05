// Optional mappings from non-domain or new DB labels to the canonical
// domain-style AttendantCategory labels used throughout the app.
//
// This file is intentionally editable — if your database has new labels
// (e.g. 'junior','senior','assistant','manager') you can map them to the
// canonical labels (e.g. 'DIRECT_SALES_OPS', 'MARKETING_OPS', ...).

export const categoryMappings: Record<string, string[]> = {
  // Mapping DB rank-style labels -> canonical app domain labels
  // Adjust if these don't match your intended meanings.
  junior: ["DIRECT_SALES_OPS"],
  assistant: ["MARKETING_OPS", "SUPPORT_OPS"],
  manager: ["JUMIA_KILIMALL_OPS"],
  senior: ["BETECH_OPS"],
};

// Note: keys are matched case-insensitively. Values should be the canonical
// enum labels used by the app (UPPER_SNAKE_CASE).
