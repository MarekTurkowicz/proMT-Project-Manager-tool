import { useMemo, useState, useRef, useLayoutEffect, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../../app/store";
import { useProject } from "../context/ProjectContext";
import {
  useListTasksQuery,
  useUpdateTaskMutation,
  useCreateTaskMutation,
  tasksApi,
} from "../../tasks/tasksApi";
import type { Task } from "../../tasks/types";
import toast from "react-hot-toast";
import "./ProjectKanban.css";
import AddTaskModal from "../../tasks/components/AddTaskModal";

type ColKey = "todo" | "doing" | "done";
type Priority = 1 | 2 | 3;

type OrderState = Record<ColKey, number[]>;

function asColKey(x: unknown): ColKey {
  return x === "doing" || x === "done" ? x : "todo";
}

function ensureUnique(arr: number[]) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of arr) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** TŁUMACZENIA */
const STATUS_LABEL_PL: Record<ColKey, string> = {
  todo: "Do zrobienia",
  doing: "W trakcie",
  done: "Zrobione",
};

const PRIORITY_LABEL_PL: Record<1 | 2 | 3, string> = {
  1: "Niski",
  2: "Średni",
  3: "Wysoki",
};

function ResizableKanbanGrid({
  children,
  minPx = 240,
  gapPx = 12,
  edgePx = 6,
}: {
  children: React.ReactNode[];
  minPx?: number;
  gapPx?: number;
  edgePx?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const dragging = useRef<null | { i: 0 | 1; startX: number; start: number[] }>(
    null
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const total = el.clientWidth - gapPx * 2;
    const w = Math.max(minPx, Math.floor(total / 3));
    const rest = total - w * 3;
    setWidths([w, w, w + rest]);
  }, [minPx, gapPx]);

  useEffect(() => {
    function onResize() {
      const el = containerRef.current;
      if (!el || widths.length !== 3) return;
      const oldTotal = widths.reduce((a, b) => a + b, 0);
      const newTotal = el.clientWidth - gapPx * 2;
      const ratio = newTotal / Math.max(1, oldTotal);
      setWidths((prev) =>
        prev.map((w) => Math.max(minPx, Math.floor(w * ratio)))
      );
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [widths, gapPx, minPx]);

  function beginDrag(i: 0 | 1, e: React.MouseEvent) {
    if (widths.length !== 3) return;
    dragging.current = { i, startX: e.clientX, start: widths.slice() };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onMove(e: MouseEvent) {
    const d = dragging.current;
    if (!d) return;
    const dx = e.clientX - d.startX;

    setWidths(() => {
      const next = d.start.slice() as [number, number, number];
      const leftIdx = d.i;
      const rightIdx = d.i + 1;

      let left = d.start[leftIdx] + dx;
      let right = d.start[rightIdx] - dx;

      if (left < minPx) {
        right -= minPx - left;
        left = minPx;
      }
      if (right < minPx) {
        left -= minPx - right;
        right = minPx;
      }

      next[leftIdx] = left;
      next[rightIdx] = right;
      return next;
    });
  }

  function onUp() {
    dragging.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  if (widths.length !== 3) {
    return <div ref={containerRef} className="kanban-grid resizable" />;
  }

  return (
    <div ref={containerRef} className="kanban-grid resizable">
      <div className="kanban-col resizable-col" style={{ width: widths[0] }}>
        {children[0]}
        <div
          className="edge-handle edge-right"
          style={{ width: edgePx }}
          onMouseDown={(e) => beginDrag(0, e)}
          title="Przeciągnij, aby zmienić szerokość"
        />
      </div>

      <div className="kanban-col resizable-col" style={{ width: widths[1] }}>
        {children[1]}
        <div
          className="edge-handle edge-right"
          style={{ width: edgePx }}
          onMouseDown={(e) => beginDrag(1, e)}
          title="Przeciągnij, aby zmienić szerokość"
        />
      </div>

      <div className="kanban-col resizable-col" style={{ width: widths[2] }}>
        {children[2]}
      </div>
    </div>
  );
}

export default function ProjectKanbanTab() {
  const project = useProject();
  const dispatch = useDispatch<AppDispatch>();

  const [search, setSearch] = useState<string>("");
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [openAdd, setOpenAdd] = useState(false);

  const queryArg = useMemo(
    () => ({ project: project.id, ordering: "-priority" as const }),
    [project.id]
  );
  const { data, isLoading, isFetching } = useListTasksQuery(queryArg);

  const tasks = useMemo(() => data?.results ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasPriorityFilter = selectedPriorities.length > 0;
    return tasks.filter((t) => {
      const matchesSearch = q ? t.title.toLowerCase().includes(q) : true;
      const matchesPriority = hasPriorityFilter
        ? selectedPriorities.includes(t.priority as Priority)
        : true;
      return matchesSearch && matchesPriority;
    });
  }, [tasks, search, selectedPriorities]);

  /** Stabilny lokalny porządek w kolumnach */
  const [order, setOrder] = useState<OrderState>({
    todo: [],
    doing: [],
    done: [],
  });

  useEffect(() => {
    if (!tasks.length) {
      setOrder({ todo: [], doing: [], done: [] });
      return;
    }

    const byId = new Map<number, Task>();
    for (const t of tasks) byId.set(t.id, t);

    setOrder((prev) => {
      const next: OrderState = {
        todo: prev.todo.slice(),
        doing: prev.doing.slice(),
        done: prev.done.slice(),
      };

      (Object.keys(next) as ColKey[]).forEach((k) => {
        next[k] = next[k].filter((id) => byId.has(id));
      });

      for (const [id, t] of byId) {
        const col = asColKey(t.status);
        for (const k of ["todo", "doing", "done"] as const) {
          if (k !== col) {
            const idx = next[k].indexOf(id);
            if (idx !== -1) next[k].splice(idx, 1);
          }
        }
      }

      for (const t of tasks) {
        const col = asColKey(t.status);
        if (!next[col].includes(t.id)) next[col].push(t.id);
      }

      next.todo = ensureUnique(next.todo);
      next.doing = ensureUnique(next.doing);
      next.done = ensureUnique(next.done);

      return next;
    });
  }, [tasks, project.id]);

  const board = useMemo(() => {
    const byId = new Map<number, Task>();
    for (const t of filtered) byId.set(t.id, t);

    const build = (col: ColKey) => {
      const ids = order[col];
      const out: Task[] = [];

      for (const id of ids) {
        const t = byId.get(id);
        if (t && asColKey(t.status) === col) out.push(t);
      }
      for (const t of filtered) {
        if (asColKey(t.status) !== col) continue;
        if (!ids.includes(t.id)) out.push(t);
      }
      return out;
    };

    return {
      todo: build("todo"),
      doing: build("doing"),
      done: build("done"),
    };
  }, [filtered, order]);

  const [updateTask] = useUpdateTaskMutation();
  const [createTask] = useCreateTaskMutation();

  function togglePriority(p: Priority) {
    setSelectedPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }
  function clearPriorities() {
    setSelectedPriorities([]);
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const srcCol = source.droppableId as ColKey;
    const dstCol = destination.droppableId as ColKey;
    const taskId = Number(draggableId);

    setOrder((prev) => {
      const next: OrderState = {
        todo: prev.todo.slice(),
        doing: prev.doing.slice(),
        done: prev.done.slice(),
      };

      const srcIdx = next[srcCol].indexOf(taskId);
      if (srcIdx !== -1) next[srcCol].splice(srcIdx, 1);

      const insertAt = Math.min(
        Math.max(destination.index, 0),
        next[dstCol].length
      );
      next[dstCol].splice(insertAt, 0, taskId);

      next.todo = ensureUnique(next.todo);
      next.doing = ensureUnique(next.doing);
      next.done = ensureUnique(next.done);

      return next;
    });

    const statusChanged = srcCol !== dstCol;

    let patch: { undo: () => void } | null = null;

    if (statusChanged) {
      patch = dispatch(
        tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
          const items = draft?.results ?? [];
          const idx = items.findIndex((t) => t.id === taskId);
          if (idx === -1) return;
          items[idx] = { ...items[idx], status: dstCol };
        })
      );
    }

    try {
      if (statusChanged) {
        await updateTask({ id: taskId, patch: { status: dstCol } }).unwrap();
      }
    } catch {
      patch?.undo();
      toast.error("Nie udało się przenieść zadania.");
    }
  }

  return (
    <div className="kanban">
      <div className="kanban-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            placeholder="Szukaj zadania…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="kanban-search"
          />
          <div className="segmented">
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.length === 0 ? "is-active" : ""
              }`}
              onClick={clearPriorities}
              title="Wyczyść filtry priorytetu"
            >
              Wszystkie
            </button>
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.includes(1) ? "is-active" : ""
              }`}
              onClick={() => togglePriority(1)}
              title="Niski"
            >
              Niski
            </button>
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.includes(2) ? "is-active" : ""
              }`}
              onClick={() => togglePriority(2)}
              title="Średni"
            >
              Średni
            </button>
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.includes(3) ? "is-active" : ""
              }`}
              onClick={() => togglePriority(3)}
              title="Wysoki"
            >
              Wysoki
            </button>
          </div>
        </div>

        <button className="btn-primary" onClick={() => setOpenAdd(true)}>
          + Dodaj zadanie
        </button>
      </div>

      <AddTaskModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={async (payload) => {
          try {
            await createTask({ ...payload, project: project.id }).unwrap();
            toast.success("Zadanie dodane!");
            setOpenAdd(false);
          } catch {
            toast.error("Nie udało się utworzyć zadania");
          }
        }}
        defaultScope="project"
        defaultProjectId={project.id}
        lockScope
      />

      {isLoading ? (
        <div className="card centered muted">Ładowanie…</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <ResizableKanbanGrid>
            {[
              <Column
                key="todo"
                title={STATUS_LABEL_PL.todo}
                droppableId="todo"
                tasks={board.todo}
              />,
              <Column
                key="doing"
                title={STATUS_LABEL_PL.doing}
                droppableId="doing"
                tasks={board.doing}
              />,
              <Column
                key="done"
                title={STATUS_LABEL_PL.done}
                droppableId="done"
                tasks={board.done}
              />,
            ]}
          </ResizableKanbanGrid>
        </DragDropContext>
      )}

      {isFetching && (
        <div className="muted" style={{ marginTop: 6 }}>
          Odświeżanie…
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  droppableId,
  tasks,
}: {
  title: string;
  droppableId: ColKey;
  tasks: Task[];
}) {
  return (
    <>
      <div className="kanban-col-head">
        <span className="kanban-col-title">{title}</span>
        <span className="kanban-col-count">{tasks.length}</span>
      </div>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            className={`kanban-col-body ${
              snapshot.isDraggingOver ? "is-over" : ""
            }`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {tasks.map((t, idx) => (
              <Draggable key={t.id} draggableId={String(t.id)} index={idx}>
                {(p, s) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    {...p.dragHandleProps}
                    className={`kanban-card ${
                      s.isDragging ? "is-dragging" : ""
                    }`}
                  >
                    <div className="kanban-card-title">{t.title}</div>
                    {t.description && (
                      <div className="kanban-card-desc">{t.description}</div>
                    )}
                    <div className="kanban-card-meta">
                      <StatusChip status={asColKey(t.status)} />
                      <PriorityChip priority={t.priority as 1 | 2 | 3} />
                      {t.due_date && (
                        <span className="meta-text">
                          • Termin: {t.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="kanban-empty">Brak zadań</div>
            )}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </>
  );
}

function StatusChip({ status }: { status: ColKey }) {
  const cls =
    status === "done"
      ? "chip--green"
      : status === "doing"
      ? "chip--amber"
      : "chip--gray";

  return <span className={`chip ${cls}`}>{STATUS_LABEL_PL[status]}</span>;
}

function PriorityChip({ priority }: { priority: 1 | 2 | 3 }) {
  const cls =
    priority >= 3 ? "chip--red" : priority === 2 ? "chip--amber" : "chip--sky";

  return <span className={`chip ${cls}`}>{PRIORITY_LABEL_PL[priority]}</span>;
}
