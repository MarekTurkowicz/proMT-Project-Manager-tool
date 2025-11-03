import { useProject } from "../context/ProjectContext";
export default function ProjectMilestonesTab() {
  const project = useProject();
  return (
    <div className="card">
      Milestones for <strong>{project.name}</strong> (to be implemented)
    </div>
  );
}
