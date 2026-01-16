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

const STATUS_LABEL_PL: Record<"todo" | "doing" | "done", string> = {
  todo: "DO ZROBIENIA",
  doing: "W TOKU",
  done: "ZROBIONE",
};

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

  const [search, setSearch] = useState("");

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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((t) => {
      const haystack = [
        t.title,
        t.description,
        t.project_name,
        t.funding_name,
        t.scope_project ? `#${t.scope_project}` : "",
        t.scope_funding ? `#${t.scope_funding}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, search]);

  // --- CREATE (Add modal) ---
  const [openAdd, setOpenAdd] = useState(false);
  const [createTask] = useCreateTaskMutation();

  const handleCreate = async (payload: CreateTaskPayload) => {
    try {
      await createTask(payload).unwrap();
      toast.success("Dodano zadanie");
      setOpenAdd(false);
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się dodać zadania");
    }
  };

  // --- DELETE ---
  const [deleteTask] = useDeleteTaskMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    const ok = window.confirm("Usunąć to zadanie?");
    if (!ok) return;
    try {
      setDeletingId(id);
      await deleteTask(id).unwrap();
      toast.success("Usunięto zadanie");
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się usunąć");
    } finally {
      setDeletingId(null);
    }
  };

  // --- EDIT (Edit modal) ---
  const [updateTask] = useUpdateTaskMutation();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleEditSubmit = async (
    id: number,
    patch: Partial<CreateTaskPayload>
  ) => {
    try {
      await updateTask({ id, patch }).unwrap();
      toast.success("Zaktualizowano zadanie");
      setEditingTask(null);
      refetch();
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się zaktualizować");
    }
  };

  return (
    <div className="tasks-page">
      {/* LEFT: filters */}
      <aside className="tasks-sidebar">
        <h2>Zadania</h2>

        <div className="filters">
          <button
            className={btn(scope === "all")}
            onClick={() => setScope("all")}
          >
            Wszystkie
          </button>
          <button
            className={btn(scope === "unassigned")}
            onClick={() => setScope("unassigned")}
          >
            Bez przypisania
          </button>
          <button
            className={btn(scope === "project")}
            onClick={() => setScope("project")}
          >
            Według projektu
          </button>

          {scope === "project" && (
            <div className="input-row">
              <label>ID projektu</label>
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
            Według finansowania
          </button>

          {scope === "funding" && (
            <div className="input-row">
              <label>ID finansowania</label>
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
          <label>Sortowanie</label>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as typeof ordering)}
          >
            <option value="-created_at">Najnowsze</option>
            <option value="created_at">Najstarsze</option>
            <option value="due_date">Termin ↑</option>
            <option value="-due_date">Termin ↓</option>
            <option value="priority">Priorytet ↑</option>
            <option value="-priority">Priorytet ↓</option>
          </select>
        </div>
      </aside>

      {/* MAIN: list */}
      <main className="tasks-main">
        <header className="tasks-header">
          <h1>Zadania</h1>

          <div className="header-actions">
            <input
              className="form-input"
              placeholder="Wyszukaj zadanie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 300 }}
            />

            <button className="btn-primary" onClick={() => setOpenAdd(true)}>
              Dodaj zadanie
            </button>

            <span className="muted">
              {isFetching
                ? "Wczytywanie…"
                : search.trim()
                ? `${filteredItems.length} / ${data?.count ?? 0}`
                : `${data?.count ?? 0} łącznie`}
            </span>
          </div>
        </header>

        <div className="tasks-scroll">
          {/* ADD MODAL */}
          <AddTaskModal
            open={openAdd}
            onClose={() => setOpenAdd(false)}
            onSubmit={handleCreate}
          />

          {isLoading ? (
            <div className="card centered muted">Wczytywanie…</div>
          ) : error ? (
            <div className="card error">Nie udało się wczytać zadań.</div>
          ) : filteredItems.length === 0 ? (
            <div className="card centered muted">
              {search.trim() ? "Brak wyników wyszukiwania." : "Brak zadań."}
            </div>
          ) : (
            <div className="tasks-list">
              {filteredItems.map((t) => (
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
        </div>

        {/* EDIT MODAL */}
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
      ? chip("chip--red", "Wysoki")
      : task.priority === 2
      ? chip("chip--amber", "Średni")
      : chip("chip--sky", "Niski");

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
            {chip(statusCls, STATUS_LABEL_PL[statusSafe])}
            {prio}
            {projectName && (
              <span className="meta-text">• Projekt: {projectName}</span>
            )}
            {fundingName && (
              <span className="meta-text">• Finansowanie: {fundingName}</span>
            )}
            {task.due_date && (
              <span className="meta-text">• Termin: {task.due_date}</span>
            )}
          </div>
        </div>

        <div className="task-actions">
          <button className="btn" onClick={onStartEdit} title="Edytuj">
            Edytuj
          </button>
          <button
            className="btn-danger"
            onClick={() => onDelete(task.id)}
            disabled={deleting}
            title="Usuń zadanie"
          >
            {deleting ? "Usuwanie…" : "Usuń"}
          </button>
        </div>
      </div>
    </div>
  );
}
