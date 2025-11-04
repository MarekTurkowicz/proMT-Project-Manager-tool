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

/** Grid z uchwytami na krawędziach kolumn (prawa ścianka kolumny 1 i 2) */
function ResizableKanbanGrid({
  children,
  minPx = 240,
  gapPx = 12,
  edgePx = 6, // szerokość strefy chwytu wewnątrz kolumny
}: {
  children: React.ReactNode[]; // [col1, col2, col3]
  minPx?: number;
  gapPx?: number;
  edgePx?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const dragging = useRef<null | { i: 0 | 1; startX: number; start: number[] }>(
    null
  );

  // inicjalny podział
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const total = el.clientWidth - gapPx * 2; // 3 kol + 2 przerwy
    const w = Math.max(minPx, Math.floor(total / 3));
    const rest = total - w * 3;
    setWidths([w, w, w + rest]);
  }, [minPx, gapPx]);

  // zachowanie proporcji przy resize okna
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

      // min szerokości
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
      {/* Kolumna 1 + uchwyt na prawej ściance */}
      <div className="kanban-col resizable-col" style={{ width: widths[0] }}>
        {children[0]}
        <div
          className="edge-handle edge-right"
          style={{ width: edgePx }}
          onMouseDown={(e) => beginDrag(0, e)}
          title="Przeciągnij, aby zmienić szerokość"
        />
      </div>

      {/* Kolumna 2 + uchwyt na prawej ściance */}
      <div className="kanban-col resizable-col" style={{ width: widths[1] }}>
        {children[1]}
        <div
          className="edge-handle edge-right"
          style={{ width: edgePx }}
          onMouseDown={(e) => beginDrag(1, e)}
          title="Przeciągnij, aby zmienić szerokość"
        />
      </div>

      {/* Kolumna 3 (bez uchwytu) */}
      <div className="kanban-col resizable-col" style={{ width: widths[2] }}>
        {children[2]}
      </div>
    </div>
  );
}

export default function ProjectKanbanTab() {
  const project = useProject();
  const dispatch = useDispatch<AppDispatch>();

  // UI filtry
  const [search, setSearch] = useState<string>("");
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [openAdd, setOpenAdd] = useState(false);

  // Tasks query (projekt, sort po priorytecie — filtr lokalny)
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

  const board = useMemo(() => {
    const by: Record<ColKey, Task[]> = { todo: [], doing: [], done: [] };
    for (const t of filtered) {
      const k: ColKey = (t.status as ColKey) ?? "todo";
      by[k].push(t);
    }
    return by;
  }, [filtered]);

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
    if (srcCol === dstCol && source.index === destination.index) return;

    const taskId = Number(draggableId);

    const patch = dispatch(
      tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
        const items = draft?.results ?? [];
        const idx = items.findIndex((t) => t.id === taskId);
        if (idx === -1) return;
        items[idx] = { ...items[idx], status: dstCol };
      })
    );

    try {
      await updateTask({ id: taskId, patch: { status: dstCol } }).unwrap();
    } catch {
      patch.undo();
      toast.error("Nie udało się przenieść zadania.");
    }
  }

  return (
    <div className="kanban">
      {/* Toolbar */}
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
              All
            </button>
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.includes(1) ? "is-active" : ""
              }`}
              onClick={() => togglePriority(1)}
              title="Low"
            >
              Low
            </button>
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.includes(2) ? "is-active" : ""
              }`}
              onClick={() => togglePriority(2)}
              title="Medium"
            >
              Medium
            </button>
            <button
              type="button"
              className={`segmented-btn ${
                selectedPriorities.includes(3) ? "is-active" : ""
              }`}
              onClick={() => togglePriority(3)}
              title="High"
            >
              High
            </button>
          </div>
        </div>

        <button className="btn-primary" onClick={() => setOpenAdd(true)}>
          + Add task
        </button>
      </div>

      {/* Modal dodawania */}
      <AddTaskModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={async (payload) => {
          try {
            await createTask({ ...payload, project: project.id }).unwrap();
            toast.success("Task added!");
            setOpenAdd(false);
          } catch {
            toast.error("Failed to create task");
          }
        }}
        defaultScope="project"
        defaultProjectId={project.id}
        lockScope
      />

      {/* Board */}
      {isLoading ? (
        <div className="card centered muted">Loading…</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <ResizableKanbanGrid>
            {[
              <Column
                key="todo"
                title="To do"
                droppableId="todo"
                tasks={board.todo}
              />,
              <Column
                key="doing"
                title="Doing"
                droppableId="doing"
                tasks={board.doing}
              />,
              <Column
                key="done"
                title="Done"
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
                      <StatusChip status={t.status as ColKey} />
                      <PriorityChip priority={t.priority as 1 | 2 | 3} />
                      {t.due_date && (
                        <span className="meta-text">• Due: {t.due_date}</span>
                      )}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </>
  );
}

function StatusChip({ status }: { status: "todo" | "doing" | "done" }) {
  const cls =
    status === "done"
      ? "chip--green"
      : status === "doing"
      ? "chip--amber"
      : "chip--gray";
  return <span className={`chip ${cls}`}>{status.toUpperCase()}</span>;
}
function PriorityChip({ priority }: { priority: 1 | 2 | 3 }) {
  const cls =
    priority >= 3 ? "chip--red" : priority === 2 ? "chip--amber" : "chip--sky";
  const lbl = priority >= 3 ? "High" : priority === 2 ? "Medium" : "Low";
  return <span className={`chip ${cls}`}>{lbl}</span>;
}
