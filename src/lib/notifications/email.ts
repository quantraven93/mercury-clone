import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"Mercury Case Tracker" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlBody,
    });
    return true;
  } catch (error) {
    console.error("[Email] Send failed:", error);
    return false;
  }
}

export function formatCaseUpdateEmail(
  caseTitle: string,
  updateType: string,
  oldValue: string | null,
  newValue: string,
  courtName?: string
): string {
  const typeLabel = updateType.replace(/_/g, " ").toUpperCase();

  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">Case Update: ${typeLabel}</h2>
  </div>
  <div style="border: 1px solid #e0e0e0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
    <p><strong>Case:</strong> ${caseTitle}</p>
    ${courtName ? `<p><strong>Court:</strong> ${courtName}</p>` : ""}
    ${oldValue ? `<p><strong>Previous:</strong> ${oldValue}</p>` : ""}
    <p><strong>Current:</strong> ${newValue}</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">Mercury Case Tracker - Your Indian court case monitoring system</p>
  </div>
</body>
</html>`;
}
