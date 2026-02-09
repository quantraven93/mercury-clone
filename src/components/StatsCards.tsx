"use client";

import { Scale, Clock, CalendarDays, AlertCircle } from "lucide-react";

interface StatsCardsProps {
  total: number;
  pending: number;
  upcomingThisWeek: number;
  disposed: number;
}

export function StatsCards({
  total,
  pending,
  upcomingThisWeek,
  disposed,
}: StatsCardsProps) {
  const cards = [
    {
      label: "Total Cases",
      value: total,
      icon: Scale,
      color: "bg-indigo-50 text-indigo-600",
      iconColor: "text-indigo-500",
    },
    {
      label: "Pending",
      value: pending,
      icon: Clock,
      color: "bg-yellow-50 text-yellow-600",
      iconColor: "text-yellow-500",
    },
    {
      label: "Hearings This Week",
      value: upcomingThisWeek,
      icon: CalendarDays,
      color: "bg-blue-50 text-blue-600",
      iconColor: "text-blue-500",
    },
    {
      label: "Disposed",
      value: disposed,
      icon: AlertCircle,
      color: "bg-green-50 text-green-600",
      iconColor: "text-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {card.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
