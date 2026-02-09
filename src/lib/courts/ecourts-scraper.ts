/**
 * eCourts Services Scraper
 *
 * Scrapes case data from the eCourts system which covers:
 * - High Courts (hcservices.ecourts.gov.in)
 * - District Courts (services.ecourts.gov.in)
 *
 * Endpoints:
 * - HC cases: POST https://hcservices.ecourts.gov.in/hcservices/
 * - District cases: POST https://services.ecourts.gov.in/ecourtindv2/
 *
 * TODO: These endpoints have image-based CAPTCHA that is harder to solve
 * programmatically. For now, the scraper attempts requests and gracefully
 * returns null if CAPTCHA blocks the request. Future improvements:
 * 1. Integrate a CAPTCHA solving service (e.g., 2captcha, anti-captcha)
 * 2. Use the eCourts mobile app API which may have different auth
 * 3. Cache session tokens to reduce CAPTCHA frequency
 */

import type {
  CaseIdentifier,
  CaseStatus,
  CourtType,
  SearchResult,
  HearingEntry,
  OrderEntry,
  CourtApiProvider,
} from "./types";

// ---- Constants ----

const ECOURTS_DC_BASE = "https://services.ecourts.gov.in/ecourtindv2";
const ECOURTS_HC_BASE = "https://hcservices.ecourts.gov.in/hcservices";

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Content-Type": "application/x-www-form-urlencoded",
};

/** State code to HC court mapping for routing */
const STATE_TO_HC: Record<string, string> = {
  "1": "allahabad",
  "2": "ap",      // Andhra Pradesh
  "3": "bombay",
  "4": "calcutta",
  "5": "chhattisgarh",
  "6": "delhi",
  "7": "guwahati",
  "8": "gujarat",
  "9": "hp",      // Himachal Pradesh
  "10": "jk",     // Jammu & Kashmir
  "11": "jharkhand",
  "12": "karnataka",
  "13": "kerala",
  "14": "mp",     // Madhya Pradesh
  "15": "madras",
  "16": "manipur",
  "17": "meghalaya",
  "18": "orissa",
  "19": "patna",
  "20": "punjab",
  "21": "rajasthan",
  "22": "sikkim",
  "23": "telangana",
  "24": "tripura",
  "25": "uttarakhand",
};

// ---- Session Management ----

interface EcourtsSession {
  cookies: string;
  captchaValue?: string;
}

/**
 * Attempts to get a session from the eCourts service.
 * Returns cookies and potentially a CAPTCHA value if solvable.
 *
 * TODO: Implement CAPTCHA solving for eCourts image-based CAPTCHAs.
 * The CAPTCHA images are more complex than SC's math CAPTCHAs and
 * typically require OCR or a CAPTCHA solving service.
 */
async function getEcourtsSession(
  baseUrl: string
): Promise<EcourtsSession | null> {
  try {
    const response = await fetch(baseUrl, {
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "text/html",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!response.ok) {
      console.warn(
        `[eCourts] Failed to fetch session page: ${response.status}`
      );
      return null;
    }

    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    return { cookies };
  } catch (error) {
    console.error("[eCourts] Session fetch error:", error);
    return null;
  }
}

// ---- HTML Parsing Helpers ----

/** Strips HTML tags and decodes common entities */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a field value from an eCourts HTML response.
 * eCourts typically uses label-value pairs in table rows or divs.
 */
function extractField(html: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    // <td>Label</td><td>: Value</td>
    new RegExp(
      `<td[^>]*>\\s*${escapedLabel}\\s*</td>\\s*<td[^>]*>\\s*:?\\s*([\\s\\S]*?)</td>`,
      "i"
    ),
    // <strong>Label</strong> : Value
    new RegExp(
      `<strong[^>]*>\\s*${escapedLabel}\\s*</strong>\\s*:?\\s*([^<]+)`,
      "i"
    ),
    // <label>Label</label> <span>Value</span>
    new RegExp(
      `<label[^>]*>\\s*${escapedLabel}\\s*:?\\s*</label>\\s*<[^>]+>([^<]+)`,
      "i"
    ),
    // <b>Label :</b> Value
    new RegExp(
      `<b[^>]*>\\s*${escapedLabel}\\s*:?\\s*</b>\\s*:?\\s*([^<]+)`,
      "i"
    ),
    // Label : Value (plain text in td)
    new RegExp(
      `${escapedLabel}\\s*:\\s*([^<\\n]+)`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return stripTags(match[1]);
    }
  }
  return "";
}

/**
 * Parses case status HTML from eCourts response into a CaseStatus object.
 */
function parseEcourtsCaseHtml(html: string): CaseStatus | null {
  if (!html || html.trim().length === 0) {
    return null;
  }

  // Check if the response indicates CAPTCHA failure or no data
  if (
    html.includes("Invalid Captcha") ||
    html.includes("invalid captcha") ||
    html.includes("Captcha is required")
  ) {
    console.warn("[eCourts] CAPTCHA validation failed");
    return null;
  }

  if (
    html.includes("Record Not Found") ||
    html.includes("No Record Found") ||
    html.includes("record not found")
  ) {
    return null;
  }

  const caseTitle =
    extractField(html, "Case Title") ||
    extractField(html, "Case Details");

  const petitioner =
    extractField(html, "Petitioner") ||
    extractField(html, "Petitioner/Applicant") ||
    extractField(html, "Petitioner Name") ||
    extractField(html, "Appellant");

  const respondent =
    extractField(html, "Respondent") ||
    extractField(html, "Respondent/Opponent") ||
    extractField(html, "Respondent Name") ||
    extractField(html, "Opposite Party");

  const petitionerAdvocate =
    extractField(html, "Petitioner Advocate") ||
    extractField(html, "Advocate for Petitioner") ||
    extractField(html, "Pet\\. Adv\\.");

  const respondentAdvocate =
    extractField(html, "Respondent Advocate") ||
    extractField(html, "Advocate for Respondent") ||
    extractField(html, "Resp\\. Adv\\.");

  const currentStatus =
    extractField(html, "Case Status") ||
    extractField(html, "Status") ||
    extractField(html, "Stage of Case") ||
    "Pending";

  const judges =
    extractField(html, "Coram") ||
    extractField(html, "Judge") ||
    extractField(html, "Court Number and Judge");

  const filingDate =
    extractField(html, "Filing Date") ||
    extractField(html, "Date of Filing") ||
    extractField(html, "First Hearing Date");

  const registrationDate =
    extractField(html, "Registration Date") ||
    extractField(html, "Date of Registration");

  const nextHearingDate =
    extractField(html, "Next Hearing Date") ||
    extractField(html, "Next Date") ||
    extractField(html, "Next Date of Hearing");

  const lastOrderDate =
    extractField(html, "Last Order Date") ||
    extractField(html, "Order Date");

  const decisionDate =
    extractField(html, "Decision Date") ||
    extractField(html, "Date of Decision") ||
    extractField(html, "Disposal Date");

  // Parse acts/sections
  const acts: string[] = [];
  const actsSection = html.match(
    /(?:acts|under\s+section|act[\s-]+section)[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i
  );
  if (actsSection) {
    const actRows = actsSection[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of actRows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const cellValues = cells.map((c) => stripTags(c));
      if (cellValues.length >= 2 && !cellValues[0].toLowerCase().includes("act")) {
        acts.push(cellValues.filter(Boolean).join(" - "));
      }
    }
  }

  // Parse hearing history
  const hearingHistory: HearingEntry[] = [];
  // eCourts has a "Case History" section with a table
  const historyMatch = html.match(
    /(?:case\s+history|hearing\s+details|business\s+on\s+date)[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i
  );
  if (historyMatch) {
    const rows = historyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length >= 2) {
        const cellValues = cells.map((c) => stripTags(c));
        // Skip header rows
        if (
          cellValues[0].toLowerCase().includes("judge") ||
          cellValues[0].toLowerCase().includes("hearing") ||
          cellValues[0].toLowerCase().includes("sl") ||
          cellValues[0].toLowerCase().includes("sr") ||
          cellValues[0].toLowerCase() === "date"
        ) {
          continue;
        }
        hearingHistory.push({
          date: cellValues[0] || "",
          purpose: cellValues[1] || cellValues[2] || "",
          courtNumber: cellValues.length > 2 ? cellValues[2] : undefined,
          judge: cellValues.length > 3 ? cellValues[3] : undefined,
        });
      }
    }
  }

  // Parse orders
  const orders: OrderEntry[] = [];
  const orderMatch = html.match(
    /(?:order|orders|judgment)[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i
  );
  if (orderMatch) {
    const rows = orderMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length >= 2) {
        const cellValues = cells.map((c) => stripTags(c));
        if (
          cellValues[0].toLowerCase().includes("order") ||
          cellValues[0].toLowerCase().includes("sr") ||
          cellValues[0].toLowerCase().includes("sl") ||
          cellValues[0].toLowerCase() === "date"
        ) {
          continue;
        }

        const pdfMatch = row.match(/href=["']([^"']+)["']/i);

        orders.push({
          date: cellValues[0] || "",
          orderType: cellValues[1] || "Order",
          summary: cellValues.length > 2 ? cellValues[2] : undefined,
          pdfUrl: pdfMatch ? pdfMatch[1] : undefined,
        });
      }
    }
  }

  const resolvedTitle =
    caseTitle ||
    (petitioner && respondent
      ? `${petitioner} vs ${respondent}`
      : petitioner || respondent || "Unknown");

  return {
    caseTitle: resolvedTitle,
    currentStatus,
    petitioner,
    respondent,
    petitionerAdvocate: petitionerAdvocate || undefined,
    respondentAdvocate: respondentAdvocate || undefined,
    judges: judges || undefined,
    filingDate: filingDate || undefined,
    registrationDate: registrationDate || undefined,
    decisionDate: decisionDate || undefined,
    nextHearingDate: nextHearingDate || undefined,
    lastOrderDate: lastOrderDate || undefined,
    hearingHistory,
    orders,
    acts: acts.length > 0 ? acts : undefined,
    rawData: { sourceHtml: html },
  };
}

/**
 * Parses search results from eCourts HTML response.
 */
function parseEcourtsSearchHtml(
  html: string,
  courtType: CourtType
): SearchResult[] {
  const results: SearchResult[] = [];

  if (!html || html.includes("No Record Found") || html.includes("Record Not Found")) {
    return results;
  }

  if (html.includes("Invalid Captcha") || html.includes("invalid captcha")) {
    console.warn("[eCourts] CAPTCHA validation failed during search");
    return results;
  }

  const rows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (cells.length < 3) continue;

    const cellValues = cells.map((c) => stripTags(c));

    // Skip header rows
    if (
      cellValues[0].toLowerCase().includes("sr") ||
      cellValues[0].toLowerCase().includes("sl") ||
      cellValues[0].toLowerCase().includes("case")
    ) {
      continue;
    }

    // Try to extract CNR from a link in the row
    const cnrMatch = row.match(
      /(?:cnr_number|cnr|cino)=["']?([A-Z0-9]+)["']?/i
    );

    // Try to parse case number pattern like "WP(C)/1234/2025"
    const caseNoMatch =
      cellValues[1]?.match(/([A-Za-z/().]+)\s*\/?\s*(\d+)\s*\/\s*(\d{4})/) ||
      cellValues[2]?.match(/([A-Za-z/().]+)\s*\/?\s*(\d+)\s*\/\s*(\d{4})/);

    const titleCell = cellValues.find(
      (c) => c.includes(" vs ") || c.includes(" v. ") || c.includes(" Vs ")
    );
    const parties = titleCell?.split(/\s+(?:vs|v\.)\s+/i) || [];

    results.push({
      caseTitle: titleCell || cellValues[2] || cellValues[1] || "",
      caseNumber: caseNoMatch ? caseNoMatch[2] : cellValues[1] || "",
      caseYear: caseNoMatch ? caseNoMatch[3] : "",
      caseType: caseNoMatch ? caseNoMatch[1] : "",
      courtType,
      courtName: courtType === "HC" ? "High Court" : "District Court",
      cnrNumber: cnrMatch ? cnrMatch[1] : undefined,
      status: cellValues.find((c) =>
        /pending|disposed|dismissed|allowed|decree/i.test(c)
      ),
      petitioner: parties[0]?.trim(),
      respondent: parties[1]?.trim(),
    });
  }

  return results;
}

// ---- API Calls ----

/**
 * Fetches case status from eCourts District Court service by CNR number.
 *
 * TODO: Implement CAPTCHA solving to make this fully functional.
 * Currently returns null if CAPTCHA blocks the request.
 */
async function fetchDistrictCaseByCNR(
  cnrNumber: string
): Promise<CaseStatus | null> {
  const session = await getEcourtsSession(ECOURTS_DC_BASE);
  if (!session) return null;

  try {
    const formData = new URLSearchParams({
      cino: cnrNumber,
      // TODO: Add captcha value once CAPTCHA solving is implemented
      // captcha: session.captchaValue || "",
      ajax_req: "true",
    });

    const response = await fetch(
      `${ECOURTS_DC_BASE}/index.php`,
      {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          Cookie: session.cookies,
          Referer: ECOURTS_DC_BASE,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.warn(
        `[eCourts DC] Request failed: ${response.status}`
      );
      return null;
    }

    const html = await response.text();
    return parseEcourtsCaseHtml(html);
  } catch (error) {
    console.error("[eCourts DC] fetchDistrictCaseByCNR error:", error);
    return null;
  }
}

/**
 * Fetches case status from eCourts High Court service by CNR number.
 *
 * TODO: Implement CAPTCHA solving to make this fully functional.
 * Currently returns null if CAPTCHA blocks the request.
 */
async function fetchHCCaseByCNR(
  cnrNumber: string
): Promise<CaseStatus | null> {
  const session = await getEcourtsSession(ECOURTS_HC_BASE);
  if (!session) return null;

  try {
    const formData = new URLSearchParams({
      cino: cnrNumber,
      // TODO: Add captcha value once CAPTCHA solving is implemented
      // captcha: session.captchaValue || "",
      ajax_req: "true",
    });

    const response = await fetch(
      `${ECOURTS_HC_BASE}/index.php`,
      {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          Cookie: session.cookies,
          Referer: ECOURTS_HC_BASE,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.warn(`[eCourts HC] Request failed: ${response.status}`);
      return null;
    }

    const html = await response.text();
    return parseEcourtsCaseHtml(html);
  } catch (error) {
    console.error("[eCourts HC] fetchHCCaseByCNR error:", error);
    return null;
  }
}

/**
 * Fetches case status from eCourts by case number (District Court).
 *
 * TODO: Implement CAPTCHA solving to make this fully functional.
 */
async function fetchDistrictCaseByNumber(
  identifier: CaseIdentifier
): Promise<CaseStatus | null> {
  const session = await getEcourtsSession(ECOURTS_DC_BASE);
  if (!session) return null;

  try {
    const formData = new URLSearchParams({
      case_type: identifier.caseTypeCode || identifier.caseType,
      case_no: identifier.caseNumber,
      rgyear: identifier.caseYear,
      state_code: identifier.stateCode || "",
      dist_code: identifier.districtCode || "",
      court_code: identifier.courtCode || "",
      // TODO: Add captcha value once CAPTCHA solving is implemented
      // captcha: session.captchaValue || "",
      ajax_req: "true",
    });

    const response = await fetch(
      `${ECOURTS_DC_BASE}/index.php`,
      {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          Cookie: session.cookies,
          Referer: ECOURTS_DC_BASE,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.warn(
        `[eCourts DC] Case number request failed: ${response.status}`
      );
      return null;
    }

    const html = await response.text();
    return parseEcourtsCaseHtml(html);
  } catch (error) {
    console.error("[eCourts DC] fetchDistrictCaseByNumber error:", error);
    return null;
  }
}

/**
 * Fetches case status from eCourts by case number (High Court).
 *
 * TODO: Implement CAPTCHA solving to make this fully functional.
 */
async function fetchHCCaseByNumber(
  identifier: CaseIdentifier
): Promise<CaseStatus | null> {
  const session = await getEcourtsSession(ECOURTS_HC_BASE);
  if (!session) return null;

  try {
    const formData = new URLSearchParams({
      case_type: identifier.caseTypeCode || identifier.caseType,
      case_no: identifier.caseNumber,
      rgyear: identifier.caseYear,
      state_code: identifier.stateCode || "",
      // TODO: Add captcha value once CAPTCHA solving is implemented
      // captcha: session.captchaValue || "",
      ajax_req: "true",
    });

    const response = await fetch(
      `${ECOURTS_HC_BASE}/index.php`,
      {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          Cookie: session.cookies,
          Referer: ECOURTS_HC_BASE,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.warn(
        `[eCourts HC] Case number request failed: ${response.status}`
      );
      return null;
    }

    const html = await response.text();
    return parseEcourtsCaseHtml(html);
  } catch (error) {
    console.error("[eCourts HC] fetchHCCaseByNumber error:", error);
    return null;
  }
}

/**
 * Searches for cases by party name on eCourts District Courts.
 *
 * TODO: Implement CAPTCHA solving to make this fully functional.
 */
async function searchDistrictByPartyName(
  partyName: string,
  stateCode?: string,
  year?: string
): Promise<SearchResult[]> {
  const session = await getEcourtsSession(ECOURTS_DC_BASE);
  if (!session) return [];

  try {
    const formData = new URLSearchParams({
      partyname: partyName,
      state_code: stateCode || "",
      rgyear: year || "",
      // TODO: Add captcha value once CAPTCHA solving is implemented
      // captcha: session.captchaValue || "",
      ajax_req: "true",
    });

    const response = await fetch(
      `${ECOURTS_DC_BASE}/index.php`,
      {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          Cookie: session.cookies,
          Referer: ECOURTS_DC_BASE,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) return [];

    const html = await response.text();
    return parseEcourtsSearchHtml(html, "DC");
  } catch (error) {
    console.error("[eCourts DC] searchByPartyName error:", error);
    return [];
  }
}

/**
 * Searches for cases by party name on eCourts High Courts.
 *
 * TODO: Implement CAPTCHA solving to make this fully functional.
 */
async function searchHCByPartyName(
  partyName: string,
  stateCode?: string,
  year?: string
): Promise<SearchResult[]> {
  const session = await getEcourtsSession(ECOURTS_HC_BASE);
  if (!session) return [];

  try {
    const formData = new URLSearchParams({
      partyname: partyName,
      state_code: stateCode || "",
      rgyear: year || "",
      // TODO: Add captcha value once CAPTCHA solving is implemented
      // captcha: session.captchaValue || "",
      ajax_req: "true",
    });

    const response = await fetch(
      `${ECOURTS_HC_BASE}/index.php`,
      {
        method: "POST",
        headers: {
          ...COMMON_HEADERS,
          Cookie: session.cookies,
          Referer: ECOURTS_HC_BASE,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) return [];

    const html = await response.text();
    return parseEcourtsSearchHtml(html, "HC");
  } catch (error) {
    console.error("[eCourts HC] searchByPartyName error:", error);
    return [];
  }
}

// ---- Provider Export ----

export const ecourtsProvider: CourtApiProvider = {
  name: "eCourts Services (ecourts.gov.in)",

  async searchByPartyName(params) {
    const results: SearchResult[] = [];

    // Search HC if courtType is HC or not specified
    if (!params.courtType || params.courtType === "HC") {
      try {
        const hcResults = await searchHCByPartyName(
          params.partyName,
          params.stateCode,
          params.year
        );
        results.push(...hcResults);
      } catch (error) {
        console.error("[eCourts] HC party search failed:", error);
      }
    }

    // Search District if courtType is DC, NCLT, CF, or not specified
    if (
      !params.courtType ||
      params.courtType === "DC" ||
      params.courtType === "NCLT" ||
      params.courtType === "CF"
    ) {
      try {
        const dcResults = await searchDistrictByPartyName(
          params.partyName,
          params.stateCode,
          params.year
        );
        results.push(...dcResults);
      } catch (error) {
        console.error("[eCourts] DC party search failed:", error);
      }
    }

    return results;
  },

  async getCaseStatus(
    identifier: CaseIdentifier
  ): Promise<CaseStatus | null> {
    // Route to the appropriate court system

    // If CNR number is available, prefer CNR lookup
    if (identifier.cnrNumber) {
      const cnrResult = await this.getCaseByCNR!(identifier.cnrNumber);
      if (cnrResult) return cnrResult;
    }

    // Route based on court type
    switch (identifier.courtType) {
      case "HC":
        return await fetchHCCaseByNumber(identifier);

      case "DC":
      case "NCLT":
      case "CF":
        return await fetchDistrictCaseByNumber(identifier);

      default:
        // For unknown court types, try district first, then HC
        const dcResult = await fetchDistrictCaseByNumber(identifier);
        if (dcResult) return dcResult;
        return await fetchHCCaseByNumber(identifier);
    }
  },

  async getCaseByCNR(cnrNumber: string): Promise<CaseStatus | null> {
    if (!cnrNumber) return null;

    // CNR format: XXYY00000002025 where XX is state, YY is district
    // HC CNRs typically start with specific prefixes
    // Try HC first if the CNR pattern suggests it, otherwise try DC first

    // Heuristic: HC CNRs often have specific patterns
    // For now, try both and return the first hit
    try {
      const hcResult = await fetchHCCaseByCNR(cnrNumber);
      if (hcResult) return hcResult;
    } catch (error) {
      console.error("[eCourts] HC CNR lookup failed:", error);
    }

    try {
      const dcResult = await fetchDistrictCaseByCNR(cnrNumber);
      if (dcResult) return dcResult;
    } catch (error) {
      console.error("[eCourts] DC CNR lookup failed:", error);
    }

    return null;
  },
};
