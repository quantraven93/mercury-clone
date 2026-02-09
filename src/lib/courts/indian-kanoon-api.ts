import type { SearchResult, CourtType } from "./types";

const BASE_URL = "https://api.indiankanoon.org";

interface IKDoc {
  tid: number;
  title: string;
  headline: string;
  docsource: string;
  publishdate: string;
  numcitedby: number;
  numcites: number;
}

async function ikFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${process.env.INDIAN_KANOON_TOKEN}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new Error(`Indian Kanoon API error: ${response.status}`);
  }
  return response.json();
}

function inferCourtType(source: string): CourtType {
  if (!source) return "DC";
  const s = source.toLowerCase();
  if (s.includes("supreme court")) return "SC";
  if (s.includes("high court")) return "HC";
  if (s.includes("nclt") || s.includes("company law")) return "NCLT";
  return "DC";
}

export async function searchJudgments(
  query: string,
  pagenum = 0
): Promise<SearchResult[]> {
  const result = await ikFetch<{ docs: IKDoc[]; found: number }>("/search/", {
    formInput: query,
    pagenum: String(pagenum),
  });

  return (result.docs || []).map((doc) => ({
    caseTitle: doc.title,
    caseNumber: "",
    caseYear: doc.publishdate?.split("-")[0] || "",
    caseType: "",
    courtType: inferCourtType(doc.docsource),
    courtName: doc.docsource,
    status: "Disposed",
    petitioner: "",
    respondent: "",
  }));
}

export async function getDocument(docId: number) {
  return ikFetch(`/doc/${docId}/`);
}

export async function getDocumentMeta(docId: number) {
  return ikFetch(`/docmeta/${docId}/`);
}
