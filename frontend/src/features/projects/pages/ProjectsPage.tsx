import { useMemo, useState } from "react";
import {
  useProjectsQuery,
  useCreateMutation,
  useDeleteMutation,
  useUpdateMutation,
} from "../../api/projectsApi";
import type { Project, ProjectsListParams } from "../../types/project";
import { useMeQuery } from "../../auth/authApi";
import AddProjectModal from "../components/AddProjectModal";
import EditProjectModal from "../components/EditProjectModal";
import "../pages/ProjectPage.css";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

type ProjectsOrdering =
  | "-updated_at"
  | "updated_at"
  | "-created_at"
  | "created_at"
  | "name"
  | "-name"
  | "status"
  | "-status"
  | "start_date"
  | "-start_date"
  | "end_date"
  | "-end_date";

type StatusFilter = "all" | "new" | "active" | "closed";

export default function ProjectsPage() {
  // --- FILTRY / SORT / SEARCH ---
  const [ordering, setOrdering] = useState<ProjectsOrdering>("-updated_at");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const { data: me } = useMeQuery();
  const [onlyMine, setOnlyMine] = useState(false);

  const params = useMemo<
    ProjectsListParams & {
      status?: "new" | "active" | "closed";
      owner?: number;
    }
  >(() => {
    const p: ProjectsListParams & {
      status?: "new" | "active" | "closed";
      owner?: number;
    } = {
      ordering,
      search: search.trim() || undefined,
    };
    if (status !== "all") p.status = status;
    if (onlyMine && me?.id) p.owner = me.id;
    return p;
  }, [ordering, search, status, onlyMine, me?.id]);

  const { data, isLoading, error, refetch } = useProjectsQuery(params);
  const items: Project[] = data?.results ?? [];

  // --- MUTACJE ---
  const [createProject] = useCreateMutation();
  const [deleteProject] = useDeleteMutation();
  const [updateProject] = useUpdateMutation();

  // --- MODALE ---
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  // --- AKCJE ---
  const handleDelete = async (id: number) => {
    const ok = window.confirm("Delete this project?");
    if (!ok) return;
    try {
      await deleteProject(id).unwrap();
      toast.success("Project deleted");
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  };

  return (
    <div className="projects-page">
      {/* SIDEBAR */}
      <aside className="projects-sidebar">
        <h2>Projects</h2>

        {/* Status chips */}
        <div className="chip-group">
          <button
            className={`chip-btn ${status === "all" ? "is-active" : ""}`}
            onClick={() => setStatus("all")}
          >
            All
          </button>
          <button
            className={`chip-btn ${status === "new" ? "is-active" : ""}`}
            onClick={() => setStatus("new")}
          >
            New
          </button>
          <button
            className={`chip-btn ${status === "active" ? "is-active" : ""}`}
            onClick={() => setStatus("active")}
          >
            Active
          </button>
          <button
            className={`chip-btn ${status === "closed" ? "is-active" : ""}`}
            onClick={() => setStatus("closed")}
          >
            Closed
          </button>
        </div>

        {/* Only mine */}
        {me?.id && (
          <label className="switch-row">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
            <span>Only my projects</span>
          </label>
        )}

        {/* Sort */}
        <div className="sort">
          <label>Sort</label>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as ProjectsOrdering)}
          >
            <option value="-updated_at">Recently updated</option>
            <option value="updated_at">Least recently updated</option>
            <option value="-created_at">Newest</option>
            <option value="created_at">Oldest</option>
            <option value="name">Name A→Z</option>
            <option value="-name">Name Z→A</option>
            <option value="status">Status A→Z</option>
            <option value="-status">Status Z→A</option>
            <option value="start_date">Start ↑</option>
            <option value="-start_date">Start ↓</option>
            <option value="end_date">End ↑</option>
            <option value="-end_date">End ↓</option>
          </select>
        </div>
      </aside>

      {/* MAIN */}
      <main className="projects-main">
        {/* kompaktowy header */}
        <header className="projects-header projects-header--compact">
          <h1>Projects</h1>
          <div className="header-actions">
            <input
              className="form-input form-input--sm"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-primary" onClick={() => setOpenAdd(true)}>
              Add project
            </button>
          </div>
        </header>

        {/* SCROLL */}
        <div className="projects-scroll">
          {isLoading ? (
            <div className="card centered muted">Loading…</div>
          ) : error ? (
            <div className="card error">Failed to load projects.</div>
          ) : items.length === 0 ? (
            <div className="card centered muted">No projects.</div>
          ) : (
            <div className="projects-list">
              {items.map((p) => (
                <ProjectRow
                  key={p.id}
                  p={p}
                  onEdit={() => setEditing(p)}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* MODALE */}
        <AddProjectModal
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          onSubmit={async (payload) => {
            try {
              await createProject(payload).unwrap();
              toast.success("Project created");
              setOpenAdd(false);
              refetch();
            } catch (e) {
              console.error(e);
              toast.error("Create failed");
            }
          }}
        />

        {editing && (
          <EditProjectModal
            open={true}
            project={editing}
            onClose={() => setEditing(null)}
            onSubmit={async (id, patch) => {
              try {
                await updateProject({ id, patch }).unwrap();
                toast.success("Project updated");
                setEditing(null);
                refetch();
              } catch (e) {
                console.error(e);
                toast.error("Update failed");
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function ProjectRow({
  p,
  onEdit,
  onDelete,
}: {
  p: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="task-card">
      <div className="task-top">
        <div className="task-info">
          <h3>{p.name}</h3>
          {p.description && <p className="desc">{p.description}</p>}
          <div className="meta">
            <span className="meta-text">• Status: {p.status}</span>
            {p.start_date && (
              <span className="meta-text">• Start: {p.start_date}</span>
            )}
            {p.end_date && (
              <span className="meta-text">• End: {p.end_date}</span>
            )}
            {p.funding_ids?.length > 0 && (
              <span className="meta-text">
                • Fundings: {p.funding_ids.length}
              </span>
            )}
          </div>
        </div>

        <div className="task-actions">
          <button className="btn" onClick={onEdit} title="Edit project">
            Edit
          </button>
          <button
            className="btn-danger"
            onClick={onDelete}
            title="Delete project"
          >
            Delete
          </button>
          <Link
            className="btn"
            to={`/dashboard/projects/${p.id}/overview`}
            title="Open project"
          >
            Open project
          </Link>
        </div>
      </div>
    </div>
  );
}
