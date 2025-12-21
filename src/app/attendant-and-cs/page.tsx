"use client";

import React, { useEffect, useState } from "react";
import DailyTasksUI from "@/components/daily-tasks/DailyTasksUI";
import Sparkline from "@/app/_components/Sparkline";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";

interface Summary {
  totalProducts?: number;
  totalSales?: number;
}

export default function AttendantAndCsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reports, setReports] = useState<Array<any>>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/daily-report`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setReports(data.reports ?? []);
        setSummary(data.summary ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="att-cs-root">
      <div className="att-cs-left">
        <DailyTasksUI />
      </div>
      <aside className="att-cs-right">
        <div className="header-row">
          <Card variant="kpi">
            <div className="kpi-title">Products (today)</div>
            <div className="kpi-value">{summary ? summary.totalProducts : "—"}</div>
          </Card>
          <Card variant="kpi">
            <div className="kpi-title">Total Sales (KES)</div>
            <div className="kpi-value">{summary ? Number(summary.totalSales || 0).toLocaleString() : "—"}</div>
          </Card>
        </div>

        <div className="mt-4">
          <div className="text-sm opacity-70 mb-2">Recent products trend</div>
          <div className="spark-wrap">
            <Sparkline values={reports.slice(0, 8).map((r) => r.productsCount || 0)} color="var(--primary)" />
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm opacity-70 mb-2">Quick actions</div>
          <div className="flex gap-2">
            <Button onClick={() => window.location.href = "/admin/daily-report"} variant="secondary">Open admin</Button>
            <Button onClick={() => window.location.href = "/attendant"} variant="secondary">Attendant home</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
