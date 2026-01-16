import "../pages/FundingPage.css";
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

const FUNDING_TYPE_LABEL_PL: Record<Exclude<TypeFilter, "all">, string> = {
  grant: "Grant",
  sponsorship: "Sponsoring",
  donation: "Darowizna",
  internal: "Wewnętrzne",
};

function fundingTypeLabel(type?: Funding["type"] | null) {
  if (!type) return "—";
  return (
    FUNDING_TYPE_LABEL_PL[type as Exclude<TypeFilter, "all">] ?? String(type)
  );
}

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
      search: search.trim() || undefined,
    }),
    [ordering, search]
  );

  const { data, isLoading, error, refetch } = useListFundingsQuery(params);
  const items: Funding[] = data?.results ?? [];

  // filtr po typie (klient)
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
    const ok = window.confirm("Usunąć to finansowanie?");
    if (!ok) return;
    await deleteFunding(id).unwrap();
    refetch();
  };

  // --- TASKS: ADD / EDIT / DELETE ---
  const [createTask] = useCreateTaskMutation();
  const [openAddTask, setOpenAddTask] = useState(false);
  const [currentFundingId, setCurrentFundingId] = useState<number | null>(null);

  return (
    <div className="tasks-page">
      {/* SIDEBAR */}
      <aside className="tasks-sidebar">
        <h2>Finansowania</h2>

        <div className="filters">
          <button
            className={btn(activeType === "all")}
            onClick={() => setActiveType("all")}
          >
            Wszystkie
          </button>
          <button
            className={btn(activeType === "grant")}
            onClick={() => setActiveType("grant")}
          >
            Granty
          </button>
          <button
            className={btn(activeType === "sponsorship")}
            onClick={() => setActiveType("sponsorship")}
          >
            Sponsoring
          </button>
          <button
            className={btn(activeType === "donation")}
            onClick={() => setActiveType("donation")}
          >
            Darowizny
          </button>
          <button
            className={btn(activeType === "internal")}
            onClick={() => setActiveType("internal")}
          >
            Wewnętrzne
          </button>
        </div>

        <div className="sort">
          <label>Sortowanie</label>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as typeof ordering)}
          >
            <option value="-created_at">Najnowsze</option>
            <option value="created_at">Najstarsze</option>
            <option value="name">Nazwa A→Z</option>
            <option value="-name">Nazwa Z→A</option>
            <option value="start_date">Start ↑</option>
            <option value="-start_date">Start ↓</option>
            <option value="end_date">Koniec ↑</option>
            <option value="-end_date">Koniec ↓</option>
            <option value="amount_total">Kwota ↑</option>
            <option value="-amount_total">Kwota ↓</option>
          </select>
        </div>
      </aside>

      {/* MAIN */}
      <main className="tasks-main">
        <header className="tasks-header">
          <h1>Finansowania</h1>
          <div className="header-actions" style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              placeholder="Wyszukaj finansowanie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 300 }}
            />
            <button
              className="btn-primary"
              onClick={() => setOpenAddFunding(true)}
            >
              Dodaj finansowanie
            </button>
          </div>
        </header>

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

          {/* Add Task (scope funding) */}
          <AddTaskModal
            open={openAddTask}
            onClose={() => setOpenAddTask(false)}
            onSubmit={async (payload) => {
              await createTask(payload).unwrap();
              setOpenAddTask(false);
            }}
            defaultScope="funding"
            lockScope
            defaultFundingId={currentFundingId ?? undefined}
          />

          {isLoading ? (
            <div className="card centered muted">Wczytywanie…</div>
          ) : error ? (
            <div className="card error">Nie udało się wczytać finansowań.</div>
          ) : filtered.length === 0 ? (
            <div className="card centered muted">Brak finansowań.</div>
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
          if (willOpen) setPage(1);
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
              <span className="meta-text">
                • Typ finansowania: {fundingTypeLabel(funding.type)}
              </span>
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
            Edytuj
          </button>
          <button
            className="btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Usuń finansowanie"
          >
            Usuń
          </button>
        </div>
      </div>

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
            ({tasks.length} zadań)
            {isFetching ? " (wczytywanie…)" : ""}
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
            Dodaj zadanie
          </button>
        </div>
      </div>

      <div
        className="tasks-list"
        style={{ marginTop: 10, maxHeight: 360, overflowY: "auto" }}
      >
        {isLoading && tasks.length === 0 && (
          <div className="card centered muted">Wczytywanie zadań…</div>
        )}

        {tasks.map((t) => (
          <FundingTaskRow
            key={t.id}
            t={t}
            onEdit={() => setEditing(t)}
            onDelete={async () => {
              const ok = window.confirm("Usunąć to zadanie?");
              if (!ok) return;
              await deleteTask(t.id).unwrap();
              setPage(1);
            }}
            deleting={isDeleting}
          />
        ))}

        {!isFetching && tasks.length === 0 && (
          <div className="card centered muted">
            Brak zadań dla tego finansowania.
          </div>
        )}

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
              {isFetching ? "Wczytywanie…" : "Pokaż więcej"}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditTaskModal
          open={true}
          task={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (id, patch) => {
            await updateTask({ id, patch }).unwrap();
            setEditing(null);
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

  const STATUS_LABEL_PL: Record<"todo" | "doing" | "done", string> = {
    todo: "DO ZROBIENIA",
    doing: "W TOKU",
    done: "ZROBIONE",
  };

  const prio =
    t.priority >= 3
      ? chip("chip--red", "Wysoki")
      : t.priority === 2
      ? chip("chip--amber", "Średni")
      : chip("chip--sky", "Niski");

  return (
    <div className="task-card">
      <div className="task-top">
        <div className="task-info">
          <h3>{t.title}</h3>
          {t.description && <p className="desc">{t.description}</p>}
          <div className="meta">
            {chip(statusCls, STATUS_LABEL_PL[statusSafe])}
            {prio}
            {t.due_date && (
              <span className="meta-text">• Termin: {t.due_date}</span>
            )}
          </div>
        </div>
        <div className="task-actions">
          <button className="btn" onClick={onEdit} title="Edytuj zadanie">
            Edytuj
          </button>
          <button
            className="btn-danger"
            onClick={onDelete}
            disabled={deleting}
            title="Usuń zadanie"
          >
            {deleting ? "Usuwanie…" : "Usuń"}
          </button>
          <a
            className="btn"
            href={`/tasks?focus=${t.id}`}
            title="Otwórz w Zadaniach"
          >
            Otwórz
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
