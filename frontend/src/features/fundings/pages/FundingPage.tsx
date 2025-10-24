// src/features/fundings/pages/FundingsPage.tsx
import { useMemo, useState } from "react";
import {
  useListFundingsQuery,
  useCreateFundingMutation,
  useUpdateFundingMutation,
  useDeleteFundingMutation,
} from "../../api/fundingApi";
import {
  useListTasksQuery,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
} from "../../tasks/tasksApi";
import type {
  Funding,
  FundingCreate,
  FundingUpdate,
} from "../../types/funding";
import type { Task } from "../../tasks/types";
import AddTaskModal from "../../tasks/components/AddTaskModal";
import EditTaskModal from "../../tasks/components/EditTaskModal";
import EditFundingModal from "../components/EditFundingModal";
import AddFundingModal from "../components/AddFundingModal";

type TypeFilter = "all" | "grant" | "sponsorship" | "donation" | "internal";

export default function FundingsPage() {
  // --- FILTRY / SORT / SEARCH ---
  const [activeType, setActiveType] = useState<TypeFilter>("all");
  const [ordering, setOrdering] = useState<
    | "-created_at"
    | "created_at"
    | "start_date"
    | "-start_date"
    | "end_date"
    | "-end_date"
    | "amount_total"
    | "-amount_total"
    | "name"
    | "-name"
  >("-created_at");
  const [search, setSearch] = useState<string>("");

  const params = useMemo(
    () => ({
      ordering,
      search: search.trim() || undefined, // działa, jeśli DRF SearchFilter jest włączony globalnie
    }),
    [ordering, search]
  );
  // const { data, isLoading, isFetching, error, refetch } =
  const { data, isLoading, error, refetch } = useListFundingsQuery(params);
  const items: Funding[] = data?.results ?? [];

  // prosty filtr po typie (po stronie klienta)
  const filtered = useMemo(() => {
    if (activeType === "all") return items;
    return items.filter(
      (f): f is Funding & { type: NonNullable<Funding["type"]> } =>
        !!f.type && f.type === activeType
    );
  }, [items, activeType]);

  // --- FUNDINGS: CREATE / UPDATE / DELETE ---
  const [createFunding] = useCreateFundingMutation();
  const [updateFunding] = useUpdateFundingMutation();
  const [deleteFunding] = useDeleteFundingMutation();
  const [openAddFunding, setOpenAddFunding] = useState(false);
  const [editingFunding, setEditingFunding] = useState<Funding | null>(null);

  const handleCreateFunding = async (payload: FundingCreate) => {
    await createFunding(payload).unwrap();
    setOpenAddFunding(false);
    refetch();
  };

  const handleUpdateFunding = async (id: number, patch: FundingUpdate) => {
    await updateFunding({ id, patch }).unwrap();
    setEditingFunding(null);
    refetch();
  };

  const handleDeleteFunding = async (id: number) => {
    const ok = window.confirm("Delete this funding?");
    if (!ok) return;
    await deleteFunding(id).unwrap();
    refetch();
  };

  // --- TASKS: ADD / EDIT / DELETE (modal dodawania globalny) ---
  const [createTask] = useCreateTaskMutation();
  const [openAddTask, setOpenAddTask] = useState(false);
  const [currentFundingId, setCurrentFundingId] = useState<number | null>(null);

  return (
    <div className="tasks-page">
      {/* SIDEBAR */}
      <aside className="tasks-sidebar">
        <h2>Fundings</h2>

        <div className="filters">
          <button
            className={btn(activeType === "all")}
            onClick={() => setActiveType("all")}
          >
            All
          </button>
          <button
            className={btn(activeType === "grant")}
            onClick={() => setActiveType("grant")}
          >
            Grants
          </button>
          <button
            className={btn(activeType === "sponsorship")}
            onClick={() => setActiveType("sponsorship")}
          >
            Sponsorships
          </button>
          <button
            className={btn(activeType === "donation")}
            onClick={() => setActiveType("donation")}
          >
            Donations
          </button>
          <button
            className={btn(activeType === "internal")}
            onClick={() => setActiveType("internal")}
          >
            Internal
          </button>
        </div>

        <div className="sort">
          <label>Sort</label>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as typeof ordering)}
          >
            <option value="-created_at">Newest</option>
            <option value="created_at">Oldest</option>
            <option value="name">Name A→Z</option>
            <option value="-name">Name Z→A</option>
            <option value="start_date">Start ↑</option>
            <option value="-start_date">Start ↓</option>
            <option value="end_date">End ↑</option>
            <option value="-end_date">End ↓</option>
            <option value="amount_total">Amount ↑</option>
            <option value="-amount_total">Amount ↓</option>
          </select>
        </div>
      </aside>

      {/* MAIN */}
      <main className="tasks-main">
        <header className="tasks-header">
          <h1>Fundings</h1>
          <div className="header-actions" style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              placeholder="Search funding..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 300 }}
            />
            <button
              className="btn-primary"
              onClick={() => setOpenAddFunding(true)}
            >
              Add funding
            </button>
            {/* <span className="muted">
              {isFetching ? "Loading…" : `${data?.count ?? 0} total`}
            </span> */}
          </div>
        </header>

        {/* przewijany obszar */}
        <div className="tasks-scroll">
          {/* Add Funding */}
          <AddFundingModal
            open={openAddFunding}
            onClose={() => setOpenAddFunding(false)}
            onSubmit={handleCreateFunding}
          />

          {/* Edit Funding */}
          {editingFunding && (
            <EditFundingModal
              open={true}
              funding={editingFunding}
              onClose={() => setEditingFunding(null)}
              onSubmit={handleUpdateFunding}
            />
          )}

          {/* Add Task (scope wymuszony na funding) */}
          <AddTaskModal
            open={openAddTask}
            onClose={() => setOpenAddTask(false)}
            onSubmit={async (payload) => {
              await createTask(payload).unwrap();
              setOpenAddTask(false);
              // po dodaniu możesz odświeżyć finansowania lub akordeon; zostawiamy lekko
            }}
            defaultScope="funding"
            lockScope
            defaultFundingId={currentFundingId ?? undefined}
          />

          {isLoading ? (
            <div className="card centered muted">Loading…</div>
          ) : error ? (
            <div className="card error">Failed to load fundings.</div>
          ) : filtered.length === 0 ? (
            <div className="card centered muted">No fundings.</div>
          ) : (
            <div className="tasks-list">
              {filtered.map((f) => (
                <FundingAccordionItem
                  key={f.id}
                  funding={f}
                  onEdit={() => setEditingFunding(f)}
                  onDelete={() => handleDeleteFunding(f.id)}
                  onAddTask={(fundingId) => {
                    setCurrentFundingId(fundingId);
                    setOpenAddTask(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FundingAccordionItem({
  funding,
  onEdit,
  onDelete,
  onAddTask,
}: {
  funding: Funding;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: (fundingId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const {
    data: tasksPage,
    isFetching,
    isLoading,
  } = useListTasksQuery(
    open ? { funding: funding.id, ordering: "-created_at", page } : undefined
  );

  return (
    <div className="task-card">
      <div
        className="task-top"
        style={{ cursor: "pointer" }}
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);
          if (willOpen) setPage(1); // reset paginacji przy otwarciu
        }}
      >
        <div className="task-info">
          <h3>{funding.name}</h3>
          <p className="desc">
            {(funding.program || "—") + " • " + (funding.funder || "—")}
          </p>
          <div className="meta">
            {funding.amount_total &&
              chip(
                "chip--sky",
                `${funding.amount_total} ${funding.currency ?? "PLN"}`
              )}
            {funding.start_date && (
              <span className="meta-text">
                • {funding.start_date} → {funding.end_date || "—"}
              </span>
            )}
            {funding.type && (
              <span className="meta-text">• Type: {funding.type}</span>
            )}
          </div>
        </div>

        <div className="task-actions">
          <button
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            className="btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete funding"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Akordeon: lista zadań */}
      {open && (
        <FundingTasksPanel
          fundingId={funding.id}
          page={page}
          setPage={setPage}
          isFetching={isFetching}
          isLoading={isLoading}
          tasksPage={tasksPage}
          onAddTask={() => onAddTask(funding.id)}
        />
      )}
    </div>
  );
}

function FundingTasksPanel({
  fundingId,
  page,
  setPage,
  isFetching,
  isLoading,
  tasksPage,
  onAddTask,
}: {
  fundingId: number;
  page: number;
  setPage: (p: number) => void;
  isFetching: boolean;
  isLoading: boolean;
  tasksPage: { results: Task[]; next: string | null } | undefined;
  onAddTask: () => void;
}) {
  const tasks = tasksPage?.results ?? [];
  const canLoadMore = Boolean(tasksPage?.next);

  const [deleteTask, { isLoading: isDeleting }] = useDeleteTaskMutation();
  const [updateTask] = useUpdateTaskMutation();

  const [editing, setEditing] = useState<Task | null>(null);

  return (
    <div style={{ marginTop: 10 }}>
      <div className="task-top" style={{ justifyContent: "space-between" }}>
        <div className="meta">
          <span className="meta-text">
            ( {tasks.length}tasks)
            {isFetching ? " (loading…)" : ""}
          </span>
        </div>
        <div className="task-actions">
          <button
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
          >
            Add task
          </button>
          <a
            className="btn"
            href={`/tasks?funding=${fundingId}`}
            onClick={(e) => e.stopPropagation()}
          >
            Open in Tasks
          </a>
        </div>
      </div>

      {/* przewijany obszar na zadania w akordeonie */}
      <div
        className="tasks-list"
        style={{ marginTop: 10, maxHeight: 360, overflowY: "auto" }}
      >
        {isLoading && tasks.length === 0 && (
          <div className="card centered muted">Loading tasks…</div>
        )}

        {tasks.map((t) => (
          <FundingTaskRow
            key={t.id}
            t={t}
            onEdit={() => setEditing(t)}
            onDelete={async () => {
              const ok = window.confirm("Delete this task?");
              if (!ok) return;
              await deleteTask(t.id).unwrap();
              // po usunięciu wróć na pierwszą stronę (najprościej, żeby UI był spójny)
              setPage(1);
            }}
            deleting={isDeleting}
          />
        ))}

        {!isFetching && tasks.length === 0 && (
          <div className="card centered muted">No tasks for this funding.</div>
        )}

        {/* paginacja: prosty "Load more" */}
        {canLoadMore && (
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
          >
            <button
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                setPage(page + 1);
              }}
              disabled={isFetching}
            >
              {isFetching ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>

      {/* Modal edycji taska */}
      {editing && (
        <EditTaskModal
          open={true}
          task={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (id, patch) => {
            await updateTask({ id, patch }).unwrap();
            setEditing(null);
            // po zapisie wróć na pierwszą stronę, żeby widzieć efekt
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

function FundingTaskRow({
  t,
  onEdit,
  onDelete,
  deleting,
}: {
  t: Task;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const statusSafe = (t.status ?? "todo") as "todo" | "doing" | "done";
  const statusCls =
    statusSafe === "done"
      ? "chip--green"
      : statusSafe === "doing"
      ? "chip--amber"
      : "chip--gray";

  const prio =
    t.priority >= 3
      ? chip("chip--red", "High")
      : t.priority === 2
      ? chip("chip--amber", "Medium")
      : chip("chip--sky", "Low");

  return (
    <div className="task-card">
      <div className="task-top">
        <div className="task-info">
          <h3>{t.title}</h3>
          {t.description && <p className="desc">{t.description}</p>}
          <div className="meta">
            {chip(statusCls, statusSafe.toUpperCase())}
            {prio}
            {t.due_date && (
              <span className="meta-text">• Due: {t.due_date}</span>
            )}
          </div>
        </div>
        <div className="task-actions">
          <button className="btn" onClick={onEdit} title="Edit task">
            Edit
          </button>
          <button
            className="btn-danger"
            onClick={onDelete}
            disabled={deleting}
            title="Delete task"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <a
            className="btn"
            href={`/tasks?focus=${t.id}`}
            title="Open in Tasks"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}

function btn(active: boolean) {
  return `btn ${active ? "btn--active" : ""}`;
}

function chip(cls: string, text: string) {
  return <span className={`chip ${cls}`}>{text}</span>;
}
