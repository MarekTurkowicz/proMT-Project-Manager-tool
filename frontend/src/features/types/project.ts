export type ProjectStatus = "new" | "active" | "closed";

export interface Project {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string | null; 
  end_date: string | null;   
  funding_ids: number[];
  created_at: string;        
  updated_at: string;        
  owner: number;             
}

export type ProjectsOrdering =
  | "-updated_at" | "updated_at"
  | "-created_at" | "created_at"
  | "name" | "-name"
  | "status" | "-status"
  | "start_date" | "-start_date"
  | "end_date" | "-end_date";

export interface ProjectsListParams {
  ordering?: ProjectsOrdering;
  search?: string;
  page?: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  status?: ProjectStatus;        
  start_date?: string | null;
  end_date?: string | null;
  owner?: number;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  owner?: number;
}
