import type { Project, ProjectStatus } from "./project"; 

export type DashboardProjectStatus = ProjectStatus; 

export type ActivityLevel = "low" | "medium" | "high";

export type LastActiveProject = {
  id: number;
  name: string;
  tagline?: string; 
  status: DashboardProjectStatus;
  activityLevel: ActivityLevel;
  updatedAtISO: string; 
};

export const LS_LAST_PROJECT = "app:lastProject";

export function saveLastProject(p: Project, activityLevel: ActivityLevel = "medium") {
  const payload: LastActiveProject = {
    id: p.id,
    name: p.name,
    tagline: (p.description ?? "").trim().slice(0, 90), 
    status: p.status,
    activityLevel,
    updatedAtISO: new Date().toISOString(),
  };

  localStorage.setItem(LS_LAST_PROJECT, JSON.stringify(payload));
}
