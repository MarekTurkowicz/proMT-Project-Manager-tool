export type ID = number;

export const FUNDING_TYPE = {
  GRANT: "grant",
  SPONSORSHIP: "sponsorship",
  DONATION: "donation",
  INTERNAL: "internal",
} as const;
export type FundingType = typeof FUNDING_TYPE[keyof typeof FUNDING_TYPE];

export interface Funding {
  id: ID;
  name: string;
  program: string | null;
  funder: string | null;
  amount_total: string | null; 
  start_date: string | null;   
  end_date: string | null;     

  type?: FundingType;
  currency?: string;                   
  agreement_number?: string | null;
  reporting_deadline?: string | null;   
  description?: string | null;
  created_at?: string;                  
}

export type FundingCreate = Omit<Funding, "id">;
export type FundingUpdate = Partial<FundingCreate>;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}


export interface FundingListParams {
  search?: string;

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

  page?: number;
  page_size?: number;

  limit?: number;
  offset?: number;
}
export interface FundingDetailVM<TTask = unknown> {
  funding: Funding;
  tasks: TTask[]; 
}
export interface TaskListForFundingParams {
  funding: ID;                
  status?: string;
  assignee?: number;
  priority?: number | string;
  ordering?: string;
  page?: number;
  page_size?: number;
  limit?: number;
  offset?: number;
}

export interface FundingWithTaskTitles extends Funding {
  tasks: string[];
}
