"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn, COURT_TYPE_COLORS } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface HearingEvent {
  id: string;
  case_title: string;
  court_type: string;
  case_number: string;
  next_hearing_date: string;
}

export default function CalendarPage() {
  const [cases, setCases] = useState<HearingEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data) => {
        setCases(
          (data.cases || []).filter(
            (c: HearingEvent) => c.next_hearing_date
          )
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  function getCasesForDay(day: Date) {
    return cases.filter((c) =>
      isSameDay(new Date(c.next_hearing_date), day)
    );
  }

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500 mt-1">
              View upcoming hearings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-3 text-center text-xs font-medium text-gray-500 uppercase"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const dayCases = getCasesForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[100px] p-2 border-b border-r border-gray-100",
                      !isCurrentMonth && "bg-gray-50"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-medium mb-1",
                        isToday
                          ? "bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center"
                          : isCurrentMonth
                          ? "text-gray-900"
                          : "text-gray-300"
                      )}
                    >
                      {format(day, "d")}
                    </p>
                    <div className="space-y-1">
                      {dayCases.slice(0, 3).map((c) => (
                        <Link
                          key={c.id}
                          href={`/case/${c.id}`}
                          className={cn(
                            "block px-1.5 py-0.5 text-xs rounded truncate",
                            COURT_TYPE_COLORS[c.court_type] || "bg-gray-100"
                          )}
                          title={c.case_title || c.case_number}
                        >
                          {c.case_title
                            ? c.case_title.substring(0, 20)
                            : c.case_number}
                        </Link>
                      ))}
                      {dayCases.length > 3 && (
                        <p className="text-xs text-gray-400 px-1.5">
                          +{dayCases.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
