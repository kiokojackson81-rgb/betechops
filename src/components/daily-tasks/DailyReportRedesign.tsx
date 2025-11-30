"use client";
import React from "react";
import DailyTasksUI from "./DailyTasksUI";

export default function DailyReportRedesign() {
  // Keep the redesign as a safe wrapper that renders the canonical
  // `DailyTasksUI` component so all fields, autosave and submit behavior
  // are preserved exactly. We can progressively restyle later.
  return <DailyTasksUI />;
}
