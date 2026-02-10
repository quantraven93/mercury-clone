/**
 * Indian Kanoon Search — scrapes the public website (no API key needed).
 *
 * The free website at indiankanoon.org supports the same query syntax as
 * the paid API: doctypes, year filters, party-name search, etc.
 * We fetch the search results page and parse the HTML to extract cases.
 */

import type { SearchResult, CourtType } from "./types";

const IK_BASE = "https://indiankanoon.org";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function inferCourtType(source: string): CourtType {
  if (!source) return "DC";
  const s = source.toLowerCase();
  if (s.includes("supreme court")) return "SC";
  if (s.includes("high court")) return "HC";
  if (s.includes("tribunal") || s.includes("nclt") || s.includes("company law"))
    return "NCLT";
  if (s.includes("consumer") || s.includes("ncdrc")) return "CF";
  return "DC";
}

/**
 * Extract case number and year from a title like
 * "Ravi Kumar vs State of AP on 12 March, 2023"
 * or "C.A. No. 1234/2022"
 */
function extractCaseInfo(title: string): { caseNumber: string; caseYear: string } {
  // Try "No. 1234/2022" or "1234 of 2022"
  const noMatch = title.match(
    /(?:No\.?\s*)?(\d+)\s*(?:\/|of)\s*((?:19|20)\d{2})/i
  );
  if (noMatch) return { caseNumber: noMatch[1], caseYear: noMatch[2] };

  // Try year from "on DD Month, YYYY"
  const dateMatch = title.match(/on\s+\d{1,2}\s+\w+,?\s+((?:19|20)\d{2})/);
  if (dateMatch) return { caseNumber: "", caseYear: dateMatch[1] };

  return { caseNumber: "", caseYear: "" };
}

/**
 * Parse parties from title: "Petitioner vs Respondent"
 */
function parseParties(title: string): {
  petitioner: string;
  respondent: string;
  cleanTitle: string;
} {
  // Remove "on DD Month, YYYY" suffix
  const cleanTitle = title.replace(/\s+on\s+\d{1,2}\s+\w+,?\s+\d{4}$/, "").trim();
  const vsMatch = cleanTitle.split(/\s+(?:vs\.?|v\.)\s+/i);
  if (vsMatch.length >= 2) {
    return {
      petitioner: vsMatch[0].trim(),
      respondent: vsMatch.slice(1).join(" vs ").trim(),
      cleanTitle,
    };
  }
  return { petitioner: "", respondent: "", cleanTitle };
}

/**
 * Search Indian Kanoon public website and return parsed results.
 * Works without any API key.
 */
export async function searchJudgments(
  query: string,
  pagenum = 0
): Promise<SearchResult[]> {
  try {
    const formInput = encodeURIComponent(query);
    const url = `${IK_BASE}/search/?formInput=${formInput}&pagenum=${pagenum}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Indian Kanoon fetch error: ${response.status}`);
    }

    const html = await response.text();
    return parseSearchResultsHtml(html);
  } catch (error) {
    console.error("[Indian Kanoon] Search error:", error);
    return [];
  }
}

/**
 * Parse the HTML of an Indian Kanoon search results page.
 *
 * Actual structure (as of 2026):
 *   <article class="result" role="listitem">
 *     <h4 class="result_title">
 *       <a href="/docfragment/123456/?formInput=...">Title vs Party on DD Month, YYYY</a>
 *     </h4>
 *     <div class="headline">... snippet ...</div>
 *     <div class="hlbottom">
 *       <span class="docsource">Telangana High Court</span>
 *       ...
 *     </div>
 *   </article>
 */
function parseSearchResultsHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Split by <article class="result"...> blocks
  const resultBlocks = html.split(/class="result"[\s>]/);

  for (let i = 1; i < resultBlocks.length && results.length < 20; i++) {
    const block = resultBlocks[i];

    // Extract title + doc link from <h4 class="result_title"><a href="...">Title</a>
    const titleMatch = block.match(
      /class="result_title"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!titleMatch) continue;

    const docUrl = titleMatch[1];
    // Strip <b> and other HTML tags from title
    const rawTitle = titleMatch[2].replace(/<[^>]+>/g, "").trim();
    if (!rawTitle) continue;

    // Extract court source from <span class="docsource">Court Name</span>
    const sourceMatch = block.match(
      /class="docsource"[^>]*>([\s\S]*?)<\/span>/i
    );
    const courtName = sourceMatch
      ? sourceMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    const courtType = inferCourtType(courtName);
    const { caseNumber, caseYear } = extractCaseInfo(rawTitle);
    const { petitioner, respondent, cleanTitle } = parseParties(rawTitle);

    // Extract doc ID from /docfragment/ID/ or /doc/ID/ URL
    const docIdMatch = docUrl.match(/\/(?:docfragment|doc)\/(\d+)/);

    results.push({
      caseTitle: cleanTitle || rawTitle,
      caseNumber: caseNumber || (docIdMatch ? docIdMatch[1] : ""),
      caseYear,
      caseType: "",
      courtType,
      courtName,
      status: "Disposed",
      petitioner,
      respondent,
    });
  }

  return results;
}

/**
 * Search by party name across specific court types.
 * Uses Indian Kanoon's doctype filters.
 */
export async function searchByPartyName(
  partyName: string,
  courtType?: CourtType
): Promise<SearchResult[]> {
  let query = partyName;

  // Add doctype filter for specific courts
  if (courtType === "SC") {
    query += " doctypes: supremecourt";
  } else if (courtType === "HC") {
    query += " doctypes: allhighcourts";
  } else if (courtType === "DC") {
    query += " doctypes: alldistrictcourts";
  } else if (courtType === "NCLT") {
    query += " doctypes: alltribunals";
  }

  return searchJudgments(query);
}
