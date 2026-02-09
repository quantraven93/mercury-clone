import { kleopatraProvider } from "./kleopatra-api";
import { searchJudgments } from "./indian-kanoon-api";
import type { CaseIdentifier, CaseStatus, CourtType, SearchResult } from "./types";

class CourtService {
  async getCaseStatus(
    identifier: CaseIdentifier
  ): Promise<CaseStatus | null> {
    try {
      const result = await kleopatraProvider.getCaseStatus(identifier);
      if (result) return result;
    } catch (error) {
      console.error("[CourtService] Kleopatra getCaseStatus failed:", error);
    }

    if (identifier.cnrNumber && kleopatraProvider.getCaseByCNR) {
      try {
        const result = await kleopatraProvider.getCaseByCNR(
          identifier.cnrNumber
        );
        if (result) return result;
      } catch (error) {
        console.error("[CourtService] Kleopatra getCaseByCNR failed:", error);
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
    try {
      return await kleopatraProvider.searchByPartyName(params);
    } catch (error) {
      console.error("[CourtService] Kleopatra search failed:", error);
    }

    // Fallback to Indian Kanoon
    try {
      const query = params.courtType
        ? `${params.partyName} doctypes: ${
            params.courtType === "SC" ? "supremecourt" : "allhighcourts"
          }`
        : params.partyName;
      return await searchJudgments(query);
    } catch (error) {
      console.error("[CourtService] Indian Kanoon search failed:", error);
    }

    return [];
  }

  async searchJudgments(
    query: string,
    page = 0
  ): Promise<SearchResult[]> {
    return searchJudgments(query, page);
  }
}

export const courtService = new CourtService();
