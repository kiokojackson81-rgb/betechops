"use client";
import React from "react";
import DailyReportRedesignDraft from "./DailyReportRedesignDraft";

export default function DailyReportRedesign() {
  // Swap the wrapper to render the redesign draft so the new UX is shown.
  // The draft preserves the original payload/autosave behavior; after
  // QA we can remove the draft and clean up types.
  return <DailyReportRedesignDraft />;
}
