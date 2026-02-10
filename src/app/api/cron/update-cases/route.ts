/**
 * Cron endpoint: Fetches live status for all tracked cases,
 * detects changes, creates case_update records, and sends notifications.
 *
 * Called by:
 * - Vercel Cron (every 30 min) via vercel.json
 * - GitHub Actions (backup, every 30 min)
 * - Manual trigger via POST with CRON_SECRET
 *
 * Security: Requires CRON_SECRET in Authorization header.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { courtService } from "@/lib/courts/court-service";
import { notifyCaseUpdate } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import type { CaseIdentifier } from "@/lib/courts/types";

export const maxDuration = 60; // Vercel Hobby allows up to 60s

export async function GET(request: Request) {
  // Verify cron secret — Vercel Cron sends it as Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCaseUpdates();
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCaseUpdates();
}

async function runCaseUpdates() {
  const startTime = Date.now();
  const supabase = createAdminClient();

  console.log("[Cron] Starting case update job...");

  // Fetch all active cases (across all users)
  const { data: cases, error } = await supabase
    .from("cases")
    .select("*")
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[Cron] Failed to fetch cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 }
    );
  }

  if (!cases || cases.length === 0) {
    console.log("[Cron] No active cases to update");
    return NextResponse.json({
      success: true,
      casesChecked: 0,
      updatesFound: 0,
      duration: Date.now() - startTime,
    });
  }

  console.log(`[Cron] Found ${cases.length} active cases to check`);

  let casesChecked = 0;
  let updatesFound = 0;
  let errorCount = 0;

  for (const caseRow of cases) {
    // Check if we're running out of time (leave 5s buffer)
    if (Date.now() - startTime > 55000) {
      console.warn(
        `[Cron] Running low on time, stopping after ${casesChecked} cases`
      );
      break;
    }

    try {
      const identifier: CaseIdentifier = {
        courtType: caseRow.court_type,
        caseType: caseRow.case_type || "",
        caseTypeCode: caseRow.case_type_code,
        caseNumber: caseRow.case_number || "",
        caseYear: caseRow.case_year || "",
        cnrNumber: caseRow.cnr_number,
        courtCode: caseRow.court_code,
        stateCode: caseRow.state_code,
        districtCode: caseRow.district_code,
      };

      console.log(
        `[Cron] Checking case: ${caseRow.case_title} (${caseRow.court_type})`
      );

      const newStatus = await courtService.getCaseStatus(identifier);

      if (!newStatus) {
        console.warn(
          `[Cron] Could not fetch status for: ${caseRow.case_title}`
        );
        // Still update last_checked_at so we don't keep retrying immediately
        await supabase
          .from("cases")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", caseRow.id);
        casesChecked++;
        continue;
      }

      // Detect changes
      const changes: {
        type: string;
        oldValue: string | null;
        newValue: string;
      }[] = [];

      // Status change
      if (
        newStatus.currentStatus &&
        newStatus.currentStatus !== caseRow.current_status &&
        caseRow.current_status !== "Unknown"
      ) {
        changes.push({
          type: "status_change",
          oldValue: caseRow.current_status,
          newValue: newStatus.currentStatus,
        });
      }

      // Next hearing date change
      if (
        newStatus.nextHearingDate &&
        newStatus.nextHearingDate !== caseRow.next_hearing_date
      ) {
        changes.push({
          type: "hearing_date_change",
          oldValue: caseRow.next_hearing_date,
          newValue: newStatus.nextHearingDate,
        });
      }

      // New order
      if (
        newStatus.lastOrderDate &&
        newStatus.lastOrderDate !== caseRow.last_order_date
      ) {
        changes.push({
          type: "new_order",
          oldValue: caseRow.last_order_date,
          newValue: `${newStatus.lastOrderDate}${
            newStatus.lastOrderSummary
              ? ` - ${newStatus.lastOrderSummary}`
              : ""
          }`,
        });
      }

      // Update the case record
      await supabase
        .from("cases")
        .update({
          current_status: newStatus.currentStatus || caseRow.current_status,
          next_hearing_date:
            newStatus.nextHearingDate || caseRow.next_hearing_date,
          last_order_date:
            newStatus.lastOrderDate || caseRow.last_order_date,
          last_order_summary:
            newStatus.lastOrderSummary || caseRow.last_order_summary,
          petitioner: newStatus.petitioner || caseRow.petitioner,
          respondent: newStatus.respondent || caseRow.respondent,
          judges: newStatus.judges || caseRow.judges,
          raw_data: newStatus.rawData || caseRow.raw_data,
          last_checked_at: new Date().toISOString(),
          ...(changes.length > 0
            ? { last_changed_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", caseRow.id);

      // Process changes: create update records and send notifications
      for (const change of changes) {
        updatesFound++;

        // Insert case_update record
        await supabase.from("case_updates").insert({
          case_id: caseRow.id,
          update_type: change.type,
          old_value: change.oldValue,
          new_value: change.newValue,
          details: { source: "cron_update" },
        });

        // Send notification
        await notifyCaseUpdate({
          userId: caseRow.user_id,
          caseId: caseRow.id,
          caseTitle: caseRow.case_title,
          courtName: caseRow.court_name,
          updateType: change.type,
          oldValue: change.oldValue,
          newValue: change.newValue,
        });

        console.log(
          `[Cron] Change detected: ${caseRow.case_title} - ${change.type}: ${change.oldValue} -> ${change.newValue}`
        );
      }

      casesChecked++;

      // Small delay between cases to be respectful to court servers
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      errorCount++;
      console.error(
        `[Cron] Error updating case ${caseRow.case_title}:`,
        err
      );
    }
  }

  // Check for upcoming hearings (within 24 hours) and send reminders
  const tomorrow = new Date();
  tomorrow.setHours(tomorrow.getHours() + 24);
  const today = new Date();

  const { data: upcomingCases } = await supabase
    .from("cases")
    .select("*")
    .eq("is_active", true)
    .gte("next_hearing_date", today.toISOString().split("T")[0])
    .lte("next_hearing_date", tomorrow.toISOString().split("T")[0]);

  if (upcomingCases && upcomingCases.length > 0) {
    console.log(
      `[Cron] ${upcomingCases.length} cases have hearings in next 24h`
    );

    for (const c of upcomingCases) {
      await notifyCaseUpdate({
        userId: c.user_id,
        caseId: c.id,
        caseTitle: c.case_title,
        courtName: c.court_name,
        updateType: "hearing_reminder",
        oldValue: null,
        newValue: `Hearing scheduled for ${c.next_hearing_date}`,
      });
    }
  }

  const duration = Date.now() - startTime;
  console.log(
    `[Cron] Done: ${casesChecked} cases checked, ${updatesFound} updates found, ${errorCount} errors, ${duration}ms`
  );

  return NextResponse.json({
    success: true,
    casesChecked,
    updatesFound,
    errorCount,
    duration,
  });
}
