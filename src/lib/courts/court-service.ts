import { scProvider } from "./sc-scraper";
import { ecourtsProvider } from "./ecourts-scraper";
import { searchJudgments } from "./indian-kanoon-api";
import type { CaseIdentifier, CaseStatus, CourtType, SearchResult } from "./types";

class CourtService {
  async getCaseStatus(identifier: CaseIdentifier): Promise<CaseStatus | null> {
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
          const result = await scProvider.getCaseByCNR(identifier.cnrNumber);
          if (result) return result;
        } else if (ecourtsProvider.getCaseByCNR) {
          const result = await ecourtsProvider.getCaseByCNR(identifier.cnrNumber);
          if (result) return result;
        }
      } catch (error) {
        console.error("[CourtService] CNR lookup failed:", error);
      }
    }

    return null;
  }

  async searchByPartyName(params: {
    partyName: string;
    courtType?: CourtType;
    stateCode?: string;
    year?: string;
  }): Promise<SearchResult[]> {
    // Try SC first for SC court type
    if (params.courtType === "SC") {
      try {
        return await scProvider.searchByPartyName(params);
      } catch (error) {
        console.error("[CourtService] SC search failed:", error);
      }
    }

    // Try eCourts
    try {
      return await ecourtsProvider.searchByPartyName(params);
    } catch (error) {
      console.error("[CourtService] eCourts search failed:", error);
    }

    // Fallback to Indian Kanoon for judgment search
    try {
      const query = params.courtType
        ? `${params.partyName} doctypes: ${params.courtType === "SC" ? "supremecourt" : "allhighcourts"}`
        : params.partyName;
      return await searchJudgments(query);
    } catch (error) {
      console.error("[CourtService] Indian Kanoon search failed:", error);
    }

    return [];
  }

  async searchJudgments(query: string, page = 0): Promise<SearchResult[]> {
    return searchJudgments(query, page);
  }
}

export const courtService = new CourtService();
