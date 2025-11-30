"use client"

import React from "react";
import dynamic from "next/dynamic";

const DailyReportRedesign = dynamic(() => import("@/components/daily-tasks/DailyReportRedesign"), { ssr: false });

export default function DailyReportPageWrapper() {
  return <DailyReportRedesign />;
}
