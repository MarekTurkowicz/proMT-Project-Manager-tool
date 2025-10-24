// types/funding.ts

export type ID = number;

/** Typy finansowania — bez enum (lepsza zgodność z isolatedDeclarations). */
export const FUNDING_TYPE = {
  GRANT: "grant",
  SPONSORSHIP: "sponsorship",
  DONATION: "donation",
  INTERNAL: "internal",
} as const;
export type FundingType = typeof FUNDING_TYPE[keyof typeof FUNDING_TYPE];

/**
 * Funding — zgodny z Twoim FundingSerializer:
 * ["id","name","program","funder","amount_total","start_date","end_date"]
 * Dodatkowe pola z modelu pozostawiam opcjonalnie (gdybyś je dodał do serializerów).
 */
export interface Funding {
  id: ID;
  name: string;
  program: string | null;
  funder: string | null;
  amount_total: string | null; // DRF Decimal -> zazwyczaj string
  start_date: string | null;   // "YYYY-MM-DD"
  end_date: string | null;     // "YYYY-MM-DD"

  // opcjonalne z modelu/rozszerzonych serializerów:
  type?: FundingType;
  currency?: string;                    // np. "PLN"
  agreement_number?: string | null;
  reporting_deadline?: string | null;   // "YYYY-MM-DD"
  description?: string | null;
  created_at?: string;                  // ISO
}

/** Payloady formularzy (bez id). */
export type FundingCreate = Omit<Funding, "id">;
export type FundingUpdate = Partial<FundingCreate>;

/** Standardowa paginacja DRF. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Parametry listy finansowań — dopasuj do tego, co wspiera backend.
 * Zostawiam oba tryby paginacji (page/page_size i limit/offset).
 */
export interface FundingListParams {
  /** DRF SearchFilter => ?search=... (działa, jeśli ustawione globalnie w DEFAULT_FILTER_BACKENDS) */
  search?: string;

  /** DRF OrderingFilter => ?ordering=... */
  ordering?:
    | "created_at"
    | "-created_at"
    | "start_date"
    | "-start_date"
    | "end_date"
    | "-end_date"
    | "amount_total"
    | "-amount_total"
    | "name"
    | "-name";

  /** Paginacja – użyj TEGO, co masz globalnie (jedno z poniższych): */
  page?: number;
  page_size?: number;

  limit?: number;
  offset?: number;
}

/**
 * ViewModel pod ekran szczegółu finansowania — generyczny, by nie importować typu Task.
 * Użycie: FundingDetailVM<MyTaskType>
 */
export interface FundingDetailVM<TTask = unknown> {
  funding: Funding;
  tasks: TTask[]; // realne zadania z /tasks/?funding=<id> (scope__funding)
}

/**
 * Pomocnicze paramy do pobierania zadań dla finansowania
 * (mapują się na backendowy filtr scope__funding).
 */
export interface TaskListForFundingParams {
  funding: ID;                // -> scope__funding=<id>
  status?: string;
  assignee?: number;
  priority?: number | string;
  ordering?: string;
  page?: number;
  page_size?: number;
  limit?: number;
  offset?: number;
}

/**
 * (Opcjonalne) Jeśli aktualny FundingSerializer zwraca `tasks: string[]` (tytuły do podglądu),
 * możesz czasem typować odpowiedź jako FundingWithTaskTitles.
 * Prawdziwe Taski i tak pobierasz osobno z /tasks.
 */
export interface FundingWithTaskTitles extends Funding {
  tasks: string[];
}
