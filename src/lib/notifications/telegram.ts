const TELEGRAM_API = "https://api.telegram.org/bot";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  chatId: string,
  message: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[Telegram] Bot token not configured");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("[Telegram] Send failed:", result.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Telegram] Error:", error);
    return false;
  }
}

export function formatCaseUpdateMessage(
  caseTitle: string,
  updateType: string,
  oldValue: string | null,
  newValue: string,
  courtName?: string
): string {
  const typeEmoji: Record<string, string> = {
    status_change: "\u{1F504}",
    new_order: "\u{1F4CB}",
    hearing_date_change: "\u{1F4C5}",
    listing: "\u{1F4CC}",
    new_case: "\u{2705}",
  };

  const emoji = typeEmoji[updateType] || "\u{1F4E2}";
  const typeLabel = updateType.replace(/_/g, " ").toUpperCase();

  let msg = `${emoji} <b>${typeLabel}</b>\n\n`;
  msg += `<b>Case:</b> ${escapeHtml(caseTitle)}\n`;
  if (courtName) msg += `<b>Court:</b> ${escapeHtml(courtName)}\n`;
  if (oldValue) msg += `<b>Previous:</b> ${escapeHtml(oldValue)}\n`;
  msg += `<b>Current:</b> ${escapeHtml(newValue)}\n`;
  msg += `\n<i>Mercury Case Tracker</i>`;

  return msg;
}
