"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { StatsCards } from "@/components/StatsCards";
import { CaseTable } from "@/components/CaseTable";

interface CaseData {
  id: string;
  case_title: string;
  court_type: string;
  court_name: string | null;
  case_number: string;
  case_year: string | null;
  current_status: string | null;
  next_hearing_date: string | null;
  last_order_date: string | null;
  petitioner: string | null;
  respondent: string | null;
  tags: string[];
}

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data) => {
        setCases(data.cases || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalCases = cases.length;
  const pendingCases = cases.filter(
    (c) => c.current_status === "Pending"
  ).length;
  const disposedCases = cases.filter(
    (c) => c.current_status === "Disposed"
  ).length;
  const upcomingHearings = cases.filter((c) => {
    if (!c.next_hearing_date) return false;
    const d = new Date(c.next_hearing_date);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d >= now && d <= weekFromNow;
  }).length;

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your court cases
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            <StatsCards
              total={totalCases}
              pending={pendingCases}
              upcomingThisWeek={upcomingHearings}
              disposed={disposedCases}
            />
            <CaseTable cases={cases} />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
