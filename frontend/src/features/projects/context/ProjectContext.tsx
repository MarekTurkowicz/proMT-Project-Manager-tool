import { createContext, useContext } from "react";
import type { Project } from "../../types/project";

export const ProjectContext = createContext<Project | null>(null);

export function useProject(): Project {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within <ProjectProvider>");
  }
  return ctx;
}
