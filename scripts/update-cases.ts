/**
 * Case Update Script - Runs via GitHub Actions every 30 minutes.
 *
 * 1. Fetches all active tracked cases from Supabase
 * 2. Queries court API for current status of each case
 * 3. Detects changes (status, hearing date, new orders, judge changes)
 * 4. Creates case_update records and sends notifications
 * 5. Updates the case record with latest data
 */

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const ECOURTS_API_KEY = process.env.ECOURTS_API_KEY!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const KLEOPATRA_BASE = "https://court-api.kleopatra.io";

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

// ---- Court API ----

function mapCourtTypeToEndpoint(courtType: string): string {
  const map: Record<string, string> = {
    SC: "/api/v1/supreme-court",
    HC: "/api/v1/high-court",
    DC: "/api/v1/district-court",
    NCLT: "/api/v1/nclt",
    CF: "/api/v1/consumer-forum",
  };
  return map[courtType] || map.DC;
}

async function fetchCaseFromAPI(
  tracked: TrackedCase
): Promise<Record<string, unknown> | null> {
  const endpoint = mapCourtTypeToEndpoint(tracked.court_type);

  const params = new URLSearchParams();
  if (tracked.cnr_number) {
    params.set("cnr_number", tracked.cnr_number);
  } else {
    if (tracked.case_type_code) params.set("case_type", tracked.case_type_code);
    else if (tracked.case_type) params.set("case_type", tracked.case_type);
    params.set("case_number", tracked.case_number);
    params.set("case_year", tracked.case_year);
    if (tracked.state_code) params.set("state_code", tracked.state_code);
    if (tracked.district_code)
      params.set("district_code", tracked.district_code);
    if (tracked.court_code) params.set("court_code", tracked.court_code);
  }

  const url = `${KLEOPATRA_BASE}${endpoint}/case-status?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ECOURTS_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ---- Change Detection ----

function detectChanges(
  tracked: TrackedCase,
  fresh: Record<string, any>
): ChangeDetected[] {
  const changes: ChangeDetected[] = [];

  const newStatus = fresh.status || fresh.case_status;
  if (newStatus && newStatus !== tracked.current_status) {
    changes.push({
      field: "current_status",
      updateType: "status_change",
      oldValue: tracked.current_status,
      newValue: newStatus,
    });
  }

  const newHearing = fresh.next_hearing_date || fresh.next_date;
  if (newHearing && newHearing !== tracked.next_hearing_date) {
    changes.push({
      field: "next_hearing_date",
      updateType: "hearing_date_change",
      oldValue: tracked.next_hearing_date,
      newValue: newHearing,
    });
  }

  const newOrderDate = fresh.last_order_date;
  if (newOrderDate && newOrderDate !== tracked.last_order_date) {
    changes.push({
      field: "last_order_date",
      updateType: "new_order",
      oldValue: tracked.last_order_date,
      newValue: `New order on ${newOrderDate}: ${fresh.last_order || ""}`,
    });
  }

  const newJudge = fresh.judge || fresh.bench;
  if (newJudge && newJudge !== tracked.judges) {
    changes.push({
      field: "judges",
      updateType: "judge_change",
      oldValue: tracked.judges,
      newValue: newJudge,
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
      if (!fresh || (fresh as Record<string, any>).error) {
        console.warn(
          `No data for case ${tracked.id}: ${(fresh as Record<string, any>)?.error || "null response"}`
        );
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

        const f = fresh as Record<string, any>;
        await supabase
          .from("cases")
          .update({
            current_status:
              f.status || f.case_status || tracked.current_status,
            next_hearing_date:
              f.next_hearing_date ||
              f.next_date ||
              tracked.next_hearing_date,
            last_order_date:
              f.last_order_date || tracked.last_order_date,
            last_order_summary:
              f.last_order || tracked.last_order_summary,
            petitioner: f.petitioner || tracked.petitioner,
            respondent: f.respondent || tracked.respondent,
            judges: f.judge || f.bench || tracked.judges,
            raw_data: fresh,
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
