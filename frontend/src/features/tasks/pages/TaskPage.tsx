import { useMemo, useState } from "react";
import {
  useListTasksQuery,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
} from "../tasksApi";
import type { Task, CreateTaskPayload } from "../types";
import "./TaskPage.css";
import toast from "react-hot-toast";
import AddTaskModal from "../components/AddTaskModal";
import EditTaskModal from "../components/EditTaskModal";

type ScopeFilter = "all" | "project" | "funding" | "unassigned";

export default function TasksPage() {
  // --- FILTRY / SORT ---
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [projectId, setProjectId] = useState<number | "">("");
  const [fundingId, setFundingId] = useState<number | "">("");
  const [ordering, setOrdering] = useState<
    | "-created_at"
    | "created_at"
    | "due_date"
    | "-due_date"
    | "priority"
    | "-priority"
  >("-created_at");

  const params = useMemo(() => {
    switch (scope) {
      case "unassigned":
        return { unassigned: true as const, ordering };
      case "project":
        return projectId !== ""
          ? { project: Number(projectId), ordering }
          : { ordering };
      case "funding":
        return fundingId !== ""
          ? { funding: Number(fundingId), ordering }
          : { ordering };
      default:
        return { ordering };
    }
  }, [scope, projectId, fundingId, ordering]);

  const { data, isLoading, isFetching, error, refetch } =
    useListTasksQuery(params);
  const items: Task[] = data?.results ?? [];

  // --- CREATE (Add modal) ---
  const [openAdd, setOpenAdd] = useState(false);
  const [createTask] = useCreateTaskMutation();

  const handleCreate = async (payload: CreateTaskPayload) => {
    try {
      await createTask(payload).unwrap();
      toast.success("Task added");
      setOpenAdd(false);
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add task");
    }
  };

  // --- DELETE ---
  const [deleteTask] = useDeleteTaskMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;
    try {
      setDeletingId(id);
      await deleteTask(id).unwrap();
      toast.success("Task deleted");
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  // --- EDIT (Edit modal) ---
  const [updateTask] = useUpdateTaskMutation();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleEditSubmit = async (patch: Partial<CreateTaskPayload>) => {
    if (!editingTask) return;
    try {
      await updateTask({ id: editingTask.id, patch }).unwrap();
      toast.success("Task updated");
      setEditingTask(null);
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    }
  };

  return (
    <div className="tasks-page">
      {/* LEFT: filters */}
      <aside className="tasks-sidebar">
        <h2>Tasks</h2>

        <div className="filters">
          <button
            className={btn(scope === "all")}
            onClick={() => setScope("all")}
          >
            All
          </button>
          <button
            className={btn(scope === "unassigned")}
            onClick={() => setScope("unassigned")}
          >
            Unassigned
          </button>
          <button
            className={btn(scope === "project")}
            onClick={() => setScope("project")}
          >
            By project
          </button>

          {scope === "project" && (
            <div className="input-row">
              <label>Project ID</label>
              <input
                type="number"
                min={1}
                value={projectId}
                onChange={(e) =>
                  setProjectId(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="np. 5"
              />
            </div>
          )}

          <button
            className={btn(scope === "funding")}
            onClick={() => setScope("funding")}
          >
            By funding
          </button>

          {scope === "funding" && (
            <div className="input-row">
              <label>Funding ID</label>
              <input
                type="number"
                min={1}
                value={fundingId}
                onChange={(e) =>
                  setFundingId(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="np. 3"
              />
            </div>
          )}
        </div>

        <div className="sort">
          <label>Sort</label>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as typeof ordering)}
          >
            <option value="-created_at">Newest</option>
            <option value="created_at">Oldest</option>
            <option value="due_date">Due ↑</option>
            <option value="-due_date">Due ↓</option>
            <option value="priority">Priority ↑</option>
            <option value="-priority">Priority ↓</option>
          </select>
        </div>
      </aside>

      {/* MAIN: list */}
      <main className="tasks-main">
        <header className="tasks-header">
          <h1>Tasks</h1>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => setOpenAdd(true)}>
              + Add task
            </button>
            <span className="muted">
              {isFetching ? "Loading…" : `${data?.count ?? 0} total`}
            </span>
          </div>
        </header>

        {/* ADD MODAL (opcjonalnie – jeśli używasz AddTaskModal) */}
        <AddTaskModal
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          onSubmit={handleCreate}
        />

        {isLoading ? (
          <div className="card centered muted">Loading…</div>
        ) : error ? (
          <div className="card error">Failed to load tasks.</div>
        ) : items.length === 0 ? (
          <div className="card centered muted">No tasks.</div>
        ) : (
          <div className="tasks-list">
            {items.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onDelete={handleDelete}
                deleting={deletingId === t.id}
                onStartEdit={() => setEditingTask(t)}
              />
            ))}
          </div>
        )}

        {/* EDIT MODAL — renderuj tylko, gdy mamy task */}
        {editingTask && (
          <EditTaskModal
            open={true}
            onClose={() => setEditingTask(null)}
            task={editingTask}
            onSubmit={handleEditSubmit}
          />
        )}
      </main>
    </div>
  );
}

function btn(active: boolean) {
  return `btn ${active ? "btn--active" : ""}`;
}

function chip(cls: string, text: string) {
  return <span className={`chip ${cls}`}>{text}</span>;
}

function TaskCard({
  task,
  onDelete,
  deleting,
  onStartEdit,
}: {
  task: Task;
  onDelete: (id: number) => void;
  deleting: boolean;
  onStartEdit: () => void;
}) {
  const statusSafe = (task.status ?? "todo") as "todo" | "doing" | "done";
  const statusCls =
    statusSafe === "done"
      ? "chip--green"
      : statusSafe === "doing"
      ? "chip--amber"
      : "chip--gray";

  const prio =
    task.priority >= 3
      ? chip("chip--red", "High")
      : task.priority === 2
      ? chip("chip--amber", "Medium")
      : chip("chip--sky", "Low");

  const projectName =
    task.project_name ?? (task.scope_project ? `#${task.scope_project}` : "");
  const fundingName =
    task.funding_name ?? (task.scope_funding ? `#${task.scope_funding}` : "");

  return (
    <div className="task-card">
      <div className="task-top">
        <div className="task-info">
          <h3>{task.title}</h3>
          {task.description && <p className="desc">{task.description}</p>}
          <div className="meta">
            {chip(statusCls, statusSafe.toUpperCase())}
            {prio}
            {projectName && (
              <span className="meta-text">• Project: {projectName}</span>
            )}
            {fundingName && (
              <span className="meta-text">• Funding: {fundingName}</span>
            )}
            {task.due_date && (
              <span className="meta-text">• Due: {task.due_date}</span>
            )}
          </div>
        </div>

        {/* ACTIONS po prawej */}
        <div className="task-actions">
          <button className="btn" onClick={onStartEdit} title="Edit">
            Edit
          </button>
          <button
            className="btn-danger"
            onClick={() => onDelete(task.id)}
            disabled={deleting}
            title="Delete task"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
