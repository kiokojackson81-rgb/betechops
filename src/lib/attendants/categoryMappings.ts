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

  // Common free-form spellings of the canonical categories
  "direct sales ops": ["DIRECT_SALES_OPS"],
  "direct_sales_ops": ["DIRECT_SALES_OPS"],
  "directsalesops": ["DIRECT_SALES_OPS"],
  "marketing ops": ["MARKETING_OPS"],
  "marketing_ops": ["MARKETING_OPS"],
  "support ops": ["SUPPORT_OPS"],
  "support_ops": ["SUPPORT_OPS"],
  "jumia ops": ["JUMIA_KILIMALL_OPS"],
  "jumia/kilimall": ["JUMIA_KILIMALL_OPS"],
  "jumia_kilimall_ops": ["JUMIA_KILIMALL_OPS"],
  "betech ops": ["BETECH_OPS"],
  "betech_ops": ["BETECH_OPS"],
};

// Note: keys are matched case-insensitively. Values should be the canonical
// enum labels used by the app (UPPER_SNAKE_CASE).
