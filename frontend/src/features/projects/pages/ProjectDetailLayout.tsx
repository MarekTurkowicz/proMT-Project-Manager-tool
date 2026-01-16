import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useGetByIdQuery } from "../../api/projectsApi";
import ProjectProvider from "../context/ProjectProvider";
import "./ProjectDetailPage.css";

export default function ProjectDetailLayout() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const { data: project, isLoading, isError } = useGetByIdQuery(projectId);

  if (!Number.isFinite(projectId))
    return <div className="card error">Invalid project id.</div>;
  if (isLoading)
    return <div className="card centered muted">Loading project…</div>;
  if (isError || !project)
    return <div className="card error">Failed to load project.</div>;

  return (
    <ProjectProvider project={project}>
      <div className="pd-page">
        <header className="pd-header">
          <div className="pd-title">
            <h1>{project.name}</h1>
            <span className={`pd-status pd-status--${project.status}`}>
              {project.status}
            </span>
          </div>
          <div className="pd-actions">
            <Link className="btn" to="/dashboard/projects">
              Back to list
            </Link>
          </div>
        </header>

        <nav className="pd-tabs">
          <TabLink to="overview" label="Overview" />
          <TabLink to="fundings" label="Fundings" />
          <TabLink to="tasks" label="Tasks" />
          <TabLink to="kanban" label="Kanban" />
          <TabLink to="timeline" label="Timeline" />
          <TabLink to="team" label="Team" />
        </nav>

        <section className="pd-content">
          <Outlet />
        </section>
      </div>
    </ProjectProvider>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => "pd-tab " + (isActive ? "is-active" : "")}
    >
      {label}
    </NavLink>
  );
}
