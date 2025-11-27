"use client"

import React from "react";
import dynamic from "next/dynamic";

const DailyTasksUI = dynamic(() => import("@/components/daily-tasks/DailyTasksUI"), { ssr: false });

export default function DailyReportPageWrapper() {
  return (
    <div className="p-6">
      <DailyTasksUI />
    </div>
  );
}
