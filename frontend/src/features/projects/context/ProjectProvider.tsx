import { ProjectContext } from "./ProjectContext";
import type { Project } from "../../types/project";

export default function ProjectProvider({
  project,
  children,
}: {
  project: Project;
  children: React.ReactNode;
}) {
  return (
    <ProjectContext.Provider value={project}>
      {children}
    </ProjectContext.Provider>
  );
}
