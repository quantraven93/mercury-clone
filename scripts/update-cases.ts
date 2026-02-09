/**
 * Case Update Script - Runs via GitHub Actions every 30 minutes.
 *
 * 1. Fetches all active tracked cases from Supabase
 * 2. Queries court scrapers (SC / eCourts) for current status of each case
 * 3. Detects changes (status, hearing date, new orders, judge changes)
 * 4. Creates case_update records and sends notifications
 * 5. Updates the case record with latest data
 */

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { scProvider } from "../src/lib/courts/sc-scraper";
import { ecourtsProvider } from "../src/lib/courts/ecourts-scraper";
import type { CaseStatus, CaseIdentifier } from "../src/lib/courts/types";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Types ----

interface TrackedCase {
  id: string;
  user_id: string;
  court_type: string;
  court_code: string | null;
  court_name: string | null;
  state_code: string | null;
  district_code: string | null;
  case_type: string;
  case_type_code: string | null;
  case_number: string;
  case_year: string;
  cnr_number: string | null;
  case_title: string;
  current_status: string | null;
  next_hearing_date: string | null;
  last_order_date: string | null;
  judges: string | null;
}

interface ChangeDetected {
  field: string;
  updateType: string;
  oldValue: string | null;
  newValue: string;
}

// ---- Court API via Scrapers ----

async function fetchCaseFromAPI(
  tracked: TrackedCase
): Promise<CaseStatus | null> {
  const identifier: CaseIdentifier = {
    courtType: (tracked.court_type as CaseIdentifier["courtType"]) || "DC",
    caseType: tracked.case_type,
    caseTypeCode: tracked.case_type_code || undefined,
    caseNumber: tracked.case_number,
    caseYear: tracked.case_year,
    cnrNumber: tracked.cnr_number || undefined,
    courtCode: tracked.court_code || undefined,
    stateCode: tracked.state_code || undefined,
    districtCode: tracked.district_code || undefined,
  };

  if (tracked.court_type === "SC") {
    return await scProvider.getCaseStatus(identifier);
  }
  return await ecourtsProvider.getCaseStatus(identifier);
}

// ---- Change Detection ----

function detectChanges(
  tracked: TrackedCase,
  fresh: CaseStatus
): ChangeDetected[] {
  const changes: ChangeDetected[] = [];

  // Status change
  if (fresh.currentStatus && fresh.currentStatus !== tracked.current_status) {
    changes.push({
      field: "current_status",
      updateType: "status_change",
      oldValue: tracked.current_status,
      newValue: fresh.currentStatus,
    });
  }

  // Next hearing date change
  if (fresh.nextHearingDate && fresh.nextHearingDate !== tracked.next_hearing_date) {
    changes.push({
      field: "next_hearing_date",
      updateType: "hearing_date_change",
      oldValue: tracked.next_hearing_date,
      newValue: fresh.nextHearingDate,
    });
  }

  // New order detected
  if (fresh.lastOrderDate && fresh.lastOrderDate !== tracked.last_order_date) {
    changes.push({
      field: "last_order_date",
      updateType: "new_order",
      oldValue: tracked.last_order_date,
      newValue: `New order on ${fresh.lastOrderDate}: ${fresh.lastOrderSummary || ""}`,
    });
  }

  // Judge/bench change
  if (fresh.judges && fresh.judges !== tracked.judges) {
    changes.push({
      field: "judges",
      updateType: "judge_change",
      oldValue: tracked.judges,
      newValue: fresh.judges,
    });
  }

  return changes;
}

// ---- Notifications ----

async function sendTelegram(
  chatId: string,
  message: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    const data = await resp.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

async function sendEmailNotification(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return false;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"Mercury Case Tracker" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

async function notifyUser(
  userId: string,
  caseId: string,
  caseTitle: string,
  change: ChangeDetected
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, telegram_chat_id, email_alerts, telegram_alerts")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const label = change.updateType.replace(/_/g, " ").toUpperCase();

  if (profile.telegram_alerts && profile.telegram_chat_id) {
    const msg =
      `<b>${label}</b>\n<b>Case:</b> ${caseTitle}\n` +
      (change.oldValue ? `<b>Was:</b> ${change.oldValue}\n` : "") +
      `<b>Now:</b> ${change.newValue}`;
    const sent = await sendTelegram(profile.telegram_chat_id, msg);
    await supabase.from("alert_log").insert({
      user_id: userId,
      case_id: caseId,
      alert_type: "telegram",
      subject: label,
      message: msg,
      status: sent ? "sent" : "failed",
    });
  }

  if (profile.email_alerts && profile.email) {
    const subject = `${caseTitle} - ${label}`;
    const html =
      `<h3>${label}</h3><p><strong>Case:</strong> ${caseTitle}</p>` +
      (change.oldValue
        ? `<p><strong>Was:</strong> ${change.oldValue}</p>`
        : "") +
      `<p><strong>Now:</strong> ${change.newValue}</p>`;
    const sent = await sendEmailNotification(profile.email, subject, html);
    await supabase.from("alert_log").insert({
      user_id: userId,
      case_id: caseId,
      alert_type: "email",
      subject,
      message: html,
      status: sent ? "sent" : "failed",
    });
  }
}

// ---- Hearing Reminders ----

async function checkUpcomingHearings(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setHours(tomorrow.getHours() + 24);
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data: upcomingCases } = await supabase
    .from("cases")
    .select("*")
    .gte("next_hearing_date", todayStr)
    .lte("next_hearing_date", tomorrowStr)
    .eq("is_active", true);

  if (!upcomingCases?.length) return;

  for (const c of upcomingCases) {
    const { data: existingAlert } = await supabase
      .from("alert_log")
      .select("id")
      .eq("case_id", c.id)
      .like("subject", "%HEARING REMINDER%")
      .gte("sent_at", todayStr)
      .limit(1);

    if (existingAlert?.length) continue;

    await notifyUser(
      c.user_id,
      c.id,
      c.case_title || c.case_number,
      {
        field: "next_hearing_date",
        updateType: "listing",
        oldValue: null,
        newValue: `Hearing scheduled for ${c.next_hearing_date}`,
      }
    );
  }
}

// ---- Main ----

async function main() {
  console.log(`[${new Date().toISOString()}] Starting case update...`);

  const { data: cases, error } = await supabase
    .from("cases")
    .select("*")
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("Failed to fetch cases:", error);
    process.exit(1);
  }

  if (!cases?.length) {
    console.log("No active cases to update.");
    await checkUpcomingHearings();
    return;
  }

  console.log(`Found ${cases.length} active cases to update.`);

  let updated = 0;
  let errors = 0;

  for (const tracked of cases) {
    try {
      const fresh = await fetchCaseFromAPI(tracked as TrackedCase);
      if (!fresh) {
        console.warn(`No data for case ${tracked.id}: null response`);
        errors++;
        continue;
      }

      const changes = detectChanges(tracked as TrackedCase, fresh);

      if (changes.length > 0) {
        console.log(
          `Changes detected for case ${tracked.case_title || tracked.id}: ${changes.map((c) => c.updateType).join(", ")}`
        );

        for (const change of changes) {
          await supabase.from("case_updates").insert({
            case_id: tracked.id,
            update_type: change.updateType,
            field_name: change.field,
            old_value: change.oldValue,
            new_value: change.newValue,
          });

          await notifyUser(
            tracked.user_id,
            tracked.id,
            tracked.case_title || tracked.case_number,
            change
          );
        }

        await supabase
          .from("cases")
          .update({
            current_status: fresh.currentStatus || tracked.current_status,
            next_hearing_date:
              fresh.nextHearingDate || tracked.next_hearing_date,
            last_order_date:
              fresh.lastOrderDate || tracked.last_order_date,
            last_order_summary:
              fresh.lastOrderSummary || tracked.last_order_summary,
            petitioner: fresh.petitioner || tracked.petitioner,
            respondent: fresh.respondent || tracked.respondent,
            judges: fresh.judges || tracked.judges,
            raw_data: fresh.rawData,
            last_checked_at: new Date().toISOString(),
            last_changed_at: new Date().toISOString(),
          })
          .eq("id", tracked.id);

        updated++;
      } else {
        await supabase
          .from("cases")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", tracked.id);
      }

      // Rate limit: 1 second between API calls
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`Error processing case ${tracked.id}:`, err);
      errors++;
    }
  }

  await checkUpcomingHearings();

  console.log(
    `[${new Date().toISOString()}] Update complete: ${updated} updated, ${errors} errors out of ${cases.length} cases`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
