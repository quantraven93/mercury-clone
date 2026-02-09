import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, formatCaseUpdateMessage } from "./telegram";
import { sendEmail, formatCaseUpdateEmail } from "./email";

interface NotifyParams {
  userId: string;
  caseId: string;
  caseTitle: string;
  courtName?: string;
  updateType: string;
  oldValue: string | null;
  newValue: string;
}

export async function notifyCaseUpdate(params: NotifyParams): Promise<void> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, telegram_chat_id, email_alerts, telegram_alerts")
    .eq("id", params.userId)
    .single();

  if (!profile) return;

  const promises: Promise<void>[] = [];

  if (profile.telegram_alerts && profile.telegram_chat_id) {
    promises.push(
      (async () => {
        const message = formatCaseUpdateMessage(
          params.caseTitle,
          params.updateType,
          params.oldValue,
          params.newValue,
          params.courtName
        );
        const sent = await sendTelegramMessage(
          profile.telegram_chat_id!,
          message
        );
        await supabase.from("alert_log").insert({
          user_id: params.userId,
          case_id: params.caseId,
          alert_type: "telegram",
          subject: params.updateType,
          message,
          status: sent ? "sent" : "failed",
        });
      })()
    );
  }

  if (profile.email_alerts && profile.email) {
    promises.push(
      (async () => {
        const subject = `Case Update: ${params.caseTitle} - ${params.updateType.replace(/_/g, " ")}`;
        const html = formatCaseUpdateEmail(
          params.caseTitle,
          params.updateType,
          params.oldValue,
          params.newValue,
          params.courtName
        );
        const sent = await sendEmail(profile.email, subject, html);
        await supabase.from("alert_log").insert({
          user_id: params.userId,
          case_id: params.caseId,
          alert_type: "email",
          subject,
          message: html,
          status: sent ? "sent" : "failed",
        });
      })()
    );
  }

  await Promise.allSettled(promises);
}
