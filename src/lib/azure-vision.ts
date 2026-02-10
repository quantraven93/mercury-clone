/**
 * Azure OpenAI Vision — CAPTCHA solver & AI utilities
 *
 * Uses GPT-4o with vision to:
 * 1. Solve math CAPTCHAs from court websites (SC + eCourts)
 * 2. Summarize court orders/judgments
 *
 * Cost: ~₹0.002 per CAPTCHA solve (~₹4-5/month for normal usage)
 */

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "";
const AZURE_KEY = process.env.AZURE_OPENAI_KEY || "";
const DEPLOYMENT = "gpt-4o";
const API_VERSION = "2025-01-01-preview";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

/**
 * Call Azure OpenAI Chat Completions API
 */
async function azureChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error(
      "Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY."
    );
  }

  const url = `${AZURE_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_KEY,
    },
    body: JSON.stringify({
      messages,
      max_tokens: options?.maxTokens ?? 50,
      temperature: options?.temperature ?? 0,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Azure OpenAI error ${response.status}: ${errorText.substring(0, 200)}`
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Solve a math CAPTCHA image using Azure GPT-4o Vision.
 *
 * The image shows something like "6 + 4" or "9 - 3" in stylized text.
 * GPT-4o reads the image and returns the numeric answer.
 *
 * @param imageBuffer - Raw image bytes (PNG/JPEG)
 * @returns The numeric answer as a string, or null if it fails
 */
export async function solveCaptchaWithVision(
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a CAPTCHA solver. The image shows a simple math expression like '6 + 4' or '9 - 3'. Read the numbers and operator, calculate the result, and respond with ONLY the numeric answer. Nothing else.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Solve this math CAPTCHA. Reply with only the number.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ];

    const answer = await azureChat(messages, { maxTokens: 10, temperature: 0 });

    // Extract just the number from the response
    const numMatch = answer.match(/-?\d+/);
    if (numMatch) {
      console.log(`[Azure Vision] CAPTCHA solved: "${answer}" → ${numMatch[0]}`);
      return numMatch[0];
    }

    console.warn(`[Azure Vision] Could not parse answer: "${answer}"`);
    return null;
  } catch (error) {
    console.error("[Azure Vision] CAPTCHA solve failed:", error);
    return null;
  }
}

/**
 * Summarize a court order or judgment using GPT-4o.
 *
 * @param orderText - The raw text of the order/judgment
 * @param caseTitle - The case title for context
 * @returns A concise 2-3 sentence summary
 */
export async function summarizeOrder(
  orderText: string,
  caseTitle?: string
): Promise<string> {
  try {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a legal assistant specializing in Indian court cases. Summarize the following court order/judgment in 2-3 clear sentences. Focus on: what was decided, next steps, and any important dates. Use simple language.",
      },
      {
        role: "user",
        content: `${caseTitle ? `Case: ${caseTitle}\n\n` : ""}Order/Judgment:\n${orderText.substring(0, 3000)}`,
      },
    ];

    return await azureChat(messages, { maxTokens: 200, temperature: 0.3 });
  } catch (error) {
    console.error("[Azure Vision] Summarize failed:", error);
    return "";
  }
}

/**
 * Check if Azure OpenAI is configured and available.
 */
export function isAzureConfigured(): boolean {
  return !!(AZURE_ENDPOINT && AZURE_KEY);
}
