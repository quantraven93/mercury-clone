export type CourtType = "SC" | "HC" | "DC" | "NCLT" | "CF";

export interface CaseIdentifier {
  courtType: CourtType;
  caseType: string;
  caseTypeCode?: string;
  caseNumber: string;
  caseYear: string;
  cnrNumber?: string;
  courtCode?: string;
  stateCode?: string;
  districtCode?: string;
}

export interface CaseStatus {
  caseTitle: string;
  currentStatus: string;
  petitioner: string;
  respondent: string;
  petitionerAdvocate?: string;
  respondentAdvocate?: string;
  judges?: string;
  filingDate?: string;
  registrationDate?: string;
  decisionDate?: string;
  nextHearingDate?: string;
  lastOrderDate?: string;
  lastOrderSummary?: string;
  hearingHistory: HearingEntry[];
  orders: OrderEntry[];
  acts?: string[];
  rawData: Record<string, unknown>;
}

export interface HearingEntry {
  date: string;
  purpose: string;
  courtNumber?: string;
  judge?: string;
  orderDetails?: string;
}

export interface OrderEntry {
  date: string;
  orderType: string;
  summary?: string;
  pdfUrl?: string;
}

export interface SearchResult {
  caseTitle: string;
  caseNumber: string;
  caseYear: string;
  caseType: string;
  courtType: CourtType;
  courtName: string;
  courtCode?: string;
  cnrNumber?: string;
  status?: string;
  petitioner?: string;
  respondent?: string;
  nextHearingDate?: string;
}

export interface CourtApiProvider {
  name: string;
  searchByPartyName(params: {
    partyName: string;
    courtType?: CourtType;
    stateCode?: string;
    year?: string;
  }): Promise<SearchResult[]>;
  getCaseStatus(identifier: CaseIdentifier): Promise<CaseStatus | null>;
  getCaseByCNR?(cnrNumber: string): Promise<CaseStatus | null>;
}
