// Status/priorytet zgodnie z DRF
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = 1 | 2 | 3;

/**
 * Obiekt zwracany PRZEZ API (GET /api/tasks/, GET /api/tasks/:id).
 * Zawiera pola read-only z serializera (scope_* i *_name).
 */
export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;

  cost_amount: string | null;   // DRF Decimal -> string (najbezpieczniej na froncie)
  cost_currency: string;
  receipt_url: string;
  receipt_note: string;
  est_hours: string | null;     // Decimal -> string

  template: number | null;      // jeśli zwracasz id template'u; inaczej można dać unknown|null

  created_at: string;           // ISO
  updated_at: string;           // ISO

  // READ-ONLY z serializera (wygodne do UI)
  scope_project: number | null;
  scope_funding: number | null;
  scope_project_funding: number | null;

  // Nazwy pomocnicze (opcjonalne, bo mogą nie przyjść)
  project_name?: string | null;
  funding_name?: string | null;
}

/**
 * Payload do CREATE (POST /api/tasks/).
 * Zgodnie z walidacją back-endu — można podać CO NAJWYŻEJ jedno z:
 * project | funding | project_funding — albo żadne (task "nieprzydzielony").
 */
export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;

  cost_amount?: string | null;
  cost_currency?: string;
  receipt_url?: string;
  receipt_note?: string;
  est_hours?: string | null;

  template?: number | null;

  // WRITE-ONLY scope (co najwyżej jedno z trzech)
  project?: number | null;
  funding?: number | null;
  project_funding?: number | null;
}

/**
 * Payload do UPDATE (PATCH/PUT /api/tasks/:id/).
 * Wszystkie pola opcjonalne; reguła „co najwyżej jedno scope” pozostaje.
 */
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;

  cost_amount?: string | null;
  cost_currency?: string;
  receipt_url?: string;
  receipt_note?: string;
  est_hours?: string | null;

  template?: number | null;

  project?: number | null;
  funding?: number | null;
  project_funding?: number | null;
}



export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
