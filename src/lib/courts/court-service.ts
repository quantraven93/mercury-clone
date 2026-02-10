import { scProvider } from "./sc-scraper";
import { ecourtsProvider } from "./ecourts-scraper";
import {
  searchJudgments,
  searchByPartyName as ikSearchByPartyName,
} from "./indian-kanoon-api";
import type {
  CaseIdentifier,
  CaseStatus,
  CourtType,
  SearchResult,
} from "./types";

class CourtService {
  async getCaseStatus(
    identifier: CaseIdentifier
  ): Promise<CaseStatus | null> {
    // For SC cases, use SC scraper
    if (identifier.courtType === "SC") {
      try {
        const result = await scProvider.getCaseStatus(identifier);
        if (result) return result;
      } catch (error) {
        console.error("[CourtService] SC scraper failed:", error);
      }
    }

    // For HC/DC/NCLT cases, use eCourts scraper
    try {
      const result = await ecourtsProvider.getCaseStatus(identifier);
      if (result) return result;
    } catch (error) {
      console.error("[CourtService] eCourts scraper failed:", error);
    }

    // If CNR number available, try CNR lookup
    if (identifier.cnrNumber) {
      try {
        if (identifier.courtType === "SC" && scProvider.getCaseByCNR) {
          const result = await scProvider.getCaseByCNR(
            identifier.cnrNumber
          );
          if (result) return result;
        } else if (ecourtsProvider.getCaseByCNR) {
          const result = await ecourtsProvider.getCaseByCNR(
            identifier.cnrNumber
          );
          if (result) return result;
        }
      } catch (error) {
        console.error("[CourtService] CNR lookup failed:", error);
      }
    }

    return null;
  }

  /**
   * Search for cases by party name.
   *
   * Strategy (in order):
   * 1. Indian Kanoon (free website scrape) — most reliable, works for all courts
   * 2. SC scraper (for SC-specific searches, if Tesseract is available)
   * 3. eCourts (if CAPTCHA is solved — currently broken)
   *
   * Indian Kanoon is the PRIMARY source because:
   * - No API key or CAPTCHA required
   * - Covers SC, all HCs, District courts, Tribunals
   * - Returns rich case data (title, parties, court, year)
   */
  async searchByPartyName(params: {
    partyName: string;
    courtType?: CourtType;
    stateCode?: string;
    year?: string;
  }): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    // 1. Indian Kanoon — primary search (free, no CAPTCHA)
    try {
      console.log(
        `[CourtService] Searching Indian Kanoon for: "${params.partyName}" courtType=${params.courtType || "all"}`
      );
      const ikResults = await ikSearchByPartyName(
        params.partyName,
        params.courtType
      );
      if (ikResults.length > 0) {
        console.log(
          `[CourtService] Indian Kanoon returned ${ikResults.length} results`
        );
        allResults.push(...ikResults);
      }
    } catch (error) {
      console.error("[CourtService] Indian Kanoon search failed:", error);
    }

    // 2. SC scraper for SC-specific searches (supplement IK results)
    if (params.courtType === "SC" || !params.courtType) {
      try {
        const scResults = await scProvider.searchByPartyName(params);
        if (scResults.length > 0) {
          console.log(
            `[CourtService] SC scraper returned ${scResults.length} results`
          );
          // Merge, avoiding duplicates by title similarity
          for (const sr of scResults) {
            const isDuplicate = allResults.some(
              (r) =>
                r.caseTitle &&
                sr.caseTitle &&
                r.caseTitle
                  .toLowerCase()
                  .includes(sr.caseTitle.substring(0, 30).toLowerCase())
            );
            if (!isDuplicate) allResults.push(sr);
          }
        }
      } catch (error) {
        console.error("[CourtService] SC search failed:", error);
      }
    }

    // 3. eCourts (may fail due to CAPTCHA, but try anyway)
    if (allResults.length < 5) {
      try {
        const ecResults = await ecourtsProvider.searchByPartyName(params);
        if (ecResults.length > 0) {
          console.log(
            `[CourtService] eCourts returned ${ecResults.length} results`
          );
          allResults.push(...ecResults);
        }
      } catch (error) {
        console.error("[CourtService] eCourts search failed:", error);
      }
    }

    // If still nothing, try a broader Indian Kanoon search
    if (allResults.length === 0) {
      try {
        console.log(
          "[CourtService] Trying broad Indian Kanoon judgment search..."
        );
        const broadResults = await searchJudgments(params.partyName);
        allResults.push(...broadResults);
      } catch (error) {
        console.error(
          "[CourtService] Indian Kanoon broad search failed:",
          error
        );
      }
    }

    return allResults;
  }

  async searchJudgments(
    query: string,
    page = 0
  ): Promise<SearchResult[]> {
    return searchJudgments(query, page);
  }
}

export const courtService = new CourtService();
