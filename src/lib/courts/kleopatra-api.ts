import type {
  CaseIdentifier,
  CaseStatus,
  CourtType,
  SearchResult,
  HearingEntry,
  OrderEntry,
  CourtApiProvider,
} from "./types";

const BASE_URL = "https://court-api.kleopatra.io";

function mapCourtTypeToEndpoint(courtType: CourtType): string {
  const map: Record<CourtType, string> = {
    SC: "/api/v1/supreme-court",
    HC: "/api/v1/high-court",
    DC: "/api/v1/district-court",
    NCLT: "/api/v1/nclt",
    CF: "/api/v1/consumer-forum",
  };
  return map[courtType] || map.DC;
}

async function kleopatraFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.ECOURTS_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new Error(
      `Kleopatra API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function normalizeCase(raw: Record<string, unknown>): CaseStatus {
  const r = raw as Record<string, any>;
  return {
    caseTitle:
      r.case_title || `${r.petitioner || ""} vs ${r.respondent || ""}`,
    currentStatus: r.status || r.case_status || "Unknown",
    petitioner: r.petitioner || "",
    respondent: r.respondent || "",
    petitionerAdvocate: r.petitioner_advocate,
    respondentAdvocate: r.respondent_advocate,
    judges: r.judge || r.bench,
    filingDate: r.filing_date,
    registrationDate: r.registration_date,
    decisionDate: r.decision_date,
    nextHearingDate: r.next_hearing_date || r.next_date,
    lastOrderDate: r.last_order_date,
    lastOrderSummary: r.last_order,
    hearingHistory: (r.history || []).map(
      (h: Record<string, any>): HearingEntry => ({
        date: h.hearing_date || h.date,
        purpose: h.purpose || h.business || "",
        courtNumber: h.court_no,
        judge: h.judge,
        orderDetails: h.order_details,
      })
    ),
    orders: (r.orders || []).map(
      (o: Record<string, any>): OrderEntry => ({
        date: o.order_date || o.date,
        orderType: o.order_type || "Order",
        summary: o.order_details || o.summary,
        pdfUrl: o.pdf_url || o.download_link,
      })
    ),
    acts: r.acts,
    rawData: raw,
  };
}

export const kleopatraProvider: CourtApiProvider = {
  name: "Kleopatra E-Courts API",

  async searchByPartyName(params) {
    const courtEndpoint = mapCourtTypeToEndpoint(params.courtType || "DC");
    const raw = await kleopatraFetch<Record<string, any>>(
      `${courtEndpoint}/search`,
      {
        party_name: params.partyName,
        ...(params.stateCode && { state_code: params.stateCode }),
        ...(params.year && { year: params.year }),
      }
    );

    return (raw.cases || raw.results || []).map(
      (r: Record<string, any>): SearchResult => ({
        caseTitle:
          r.case_title || `${r.petitioner || ""} vs ${r.respondent || ""}`,
        caseNumber: r.case_number || r.reg_no || "",
        caseYear: r.case_year || r.year || "",
        caseType: r.case_type || "",
        courtType: params.courtType || "DC",
        courtName: r.court_name || r.establishment || "",
        courtCode: r.court_code,
        cnrNumber: r.cnr_number,
        status: r.status,
        petitioner: r.petitioner,
        respondent: r.respondent,
        nextHearingDate: r.next_hearing_date,
      })
    );
  },

  async getCaseStatus(identifier) {
    const courtEndpoint = mapCourtTypeToEndpoint(identifier.courtType);

    const params: Record<string, string> = {};
    if (identifier.cnrNumber) {
      params.cnr_number = identifier.cnrNumber;
    } else {
      params.case_type =
        identifier.caseTypeCode || identifier.caseType;
      params.case_number = identifier.caseNumber;
      params.case_year = identifier.caseYear;
      if (identifier.stateCode) params.state_code = identifier.stateCode;
      if (identifier.districtCode)
        params.district_code = identifier.districtCode;
      if (identifier.courtCode) params.court_code = identifier.courtCode;
    }

    const raw = await kleopatraFetch<Record<string, any>>(
      `${courtEndpoint}/case-status`,
      params
    );

    if (!raw || raw.error) return null;
    return normalizeCase(raw);
  },

  async getCaseByCNR(cnrNumber: string) {
    const raw = await kleopatraFetch<Record<string, any>>(
      "/api/v1/district-court/cnr",
      { cnr_number: cnrNumber }
    );
    if (!raw || raw.error) return null;
    return normalizeCase(raw);
  },
};
