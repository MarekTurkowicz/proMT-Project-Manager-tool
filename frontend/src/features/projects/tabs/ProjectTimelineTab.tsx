import React, { useMemo, useRef, useState, useEffect } from "react";
import { useProject } from "../context/ProjectContext";
import { useListTasksQuery } from "../../tasks/tasksApi";
import type { Task } from "../../tasks/types";

/**
 * ProjectTimelineTab
 * ------------------------------------------------------
 * Wykres osi czasu (quasi-Gantt) dla zadań w danym projekcie
 * na bazie istniejącego store/API (useListTasksQuery + ProjectContext).
 *
 * Założenia:
 *  - Task posiada daty: start_date i end_date (snake_case) albo startDate / endDate.
 *    Jeżeli brak startu -> używamy endu/due_date. Jeżeli brak endu -> traktujemy jako 1-dniowy milestone.
 *  - Kolor paska zależy od statusu i priorytetu.
 *  - Proste filtry: szukaj, status (todo/doing/done), priorytet.
 *  - Zoom (piksele na dzień) i przewijanie poziome.
 *  - "Today" marker, oś miesięczna, link do karty zadania w /tasks?focus={id}.
 *
 * Nie dodaję nowych zależności – czysty React + CSS wstrzyknięty lokalnie.
 */

// ====== Typy pomocnicze ======

type ColKey = "todo" | "doing" | "done"; // zgodne z kanbanem

type Priority = 1 | 2 | 3;

type NormalizedTask = Task & {
  _start: Date | null;
  _end: Date | null;
  _hasRange: boolean; // czy mamy przedział (start-end) czy punkt
};

// ====== Narzędzia dat ======

function parseMaybeDate(val?: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function clampDate(d: Date, min: Date, max: Date): Date {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ====== Komponent ======

export default function ProjectTimelineTab() {
  const project = useProject();

  const { data, isLoading, isFetching } = useListTasksQuery(
    useMemo(
      () => ({ project: project.id, ordering: "-priority" as const }),
      [project.id]
    )
  );

  const rawTasks = useMemo(() => data?.results ?? [], [data]);

  // Local UI state
  const [search, setSearch] = useState("");
  const [statusSet, setStatusSet] = useState<ColKey[]>([]); // pusty = wszystkie
  const [prioSet, setPrioSet] = useState<Priority[]>([]);
  const [pxPerDay, setPxPerDay] = useState(18); // zoom (px/dzień)

  // Normalizacja dat i filtrowanie
  const tasks: NormalizedTask[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasStatus = statusSet.length > 0;
    const hasPrio = prioSet.length > 0;

    return rawTasks
      .map((t) => {
        // obsługa różnych nazw pól
        const sd = (t as any).start_date ?? (t as any).startDate ?? null;
        const ed =
          (t as any).end_date ??
          (t as any).endDate ??
          (t as any).due_date ??
          null;
        const start = parseMaybeDate(sd);
        const end = parseMaybeDate(ed);

        let _start: Date | null = start ?? end ?? null; // fallback do end
        let _end: Date | null = end ?? start ?? null; // fallback do start

        // jeśli tylko 1 data -> milestone (1 dzień)
        let _hasRange = !!(start && end);
        if (!_hasRange && _start) {
          _end = new Date(_start);
        }

        return { ...(t as any), _start, _end, _hasRange } as NormalizedTask;
      })
      .filter((t) => !!t._start && !!t._end) // tylko te, które mają cokolwiek do narysowania
      .filter((t) => (q ? (t.title || "").toLowerCase().includes(q) : true))
      .filter((t) =>
        hasStatus
          ? (statusSet as string[]).includes((t.status as string) ?? "todo")
          : true
      )
      .filter((t) =>
        hasPrio
          ? (prioSet as number[]).includes(t.priority as number as Priority)
          : true
      );
  }, [rawTasks, search, statusSet, prioSet]);

  // Zakres osi czasu – minimalny start i maksymalny end po filtrowaniu
  const [minDate, maxDate] = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      const min = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const max = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return [min, max] as const;
    }
    let min = tasks[0]._start!;
    let max = tasks[0]._end!;
    for (const t of tasks) {
      if (t._start! < min) min = t._start!;
      if (t._end! > max) max = t._end!;
    }
    // poszerz lekko z obu stron
    min = new Date(min.getFullYear(), min.getMonth(), 1);
    max = new Date(max.getFullYear(), max.getMonth() + 1, 0);
    return [min, max] as const;
  }, [tasks]);

  const totalDays = useMemo(
    () => Math.max(1, daysBetween(minDate, maxDate)),
    [minDate, maxDate]
  );
  const timelineWidth = useMemo(
    () => Math.max(600, Math.round(totalDays * pxPerDay)),
    [totalDays, pxPerDay]
  );

  // Skala: data -> x
  const xFromDate = (d: Date) => {
    const clamped = clampDate(d, minDate, maxDate);
    const ratio =
      (clamped.getTime() - minDate.getTime()) /
      (maxDate.getTime() - minDate.getTime());
    return Math.round(ratio * timelineWidth);
  };

  // Dodatkowe metryki
  const metrics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const doing = tasks.filter((t) => t.status === "doing").length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const avgDays = total
      ? Math.round(
          tasks.reduce((acc, t) => acc + daysBetween(t._start!, t._end!), 0) /
            total
        )
      : 0;
    return { total, done, doing, todo, avgDays };
  }, [tasks]);

  // Auto-scroll do "today" na wejściu
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const today = new Date();
    const x = xFromDate(today);
    // przewiń tak, żeby "today" było nieco z lewej
    el.scrollTo({
      left: Math.max(0, x - el.clientWidth * 0.3),
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineWidth]);

  return (
    <div className="timeline-wrap">
      <InlineStyles />

      <div className="timeline-toolbar">
        <input
          className="tl-input"
          placeholder="Szukaj zadania…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="tl-group">
          <span className="tl-label">Status:</span>
          {(["todo", "doing", "done"] as ColKey[]).map((s) => (
            <button
              key={s}
              className={
                "tl-chip " + (statusSet.includes(s) ? "is-active" : "")
              }
              onClick={() =>
                setStatusSet((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
            >
              {s.toUpperCase()}
            </button>
          ))}
          <button className="tl-link" onClick={() => setStatusSet([])}>
            wyczyść
          </button>
        </div>

        <div className="tl-group">
          <span className="tl-label">Priorytet:</span>
          {([1, 2, 3] as Priority[]).map((p) => (
            <button
              key={p}
              className={
                "tl-chip prio-" + p + (prioSet.includes(p) ? " is-active" : "")
              }
              onClick={() =>
                setPrioSet((prev) =>
                  prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                )
              }
            >
              {p === 3 ? "High" : p === 2 ? "Medium" : "Low"}
            </button>
          ))}
          <button className="tl-link" onClick={() => setPrioSet([])}>
            wyczyść
          </button>
        </div>

        <div className="tl-group" style={{ marginLeft: "auto" }}>
          <span className="tl-label">Zoom:</span>
          <input
            type="range"
            min={6}
            max={40}
            step={1}
            value={pxPerDay}
            onChange={(e) => setPxPerDay(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      <div className="timeline-metrics">
        <Metric label="Tasks" value={String(metrics.total)} />
        <Metric label="Done" value={String(metrics.done)} />
        <Metric label="Doing" value={String(metrics.doing)} />
        <Metric label="To do" value={String(metrics.todo)} />
        <Metric label="Średni czas" value={`${metrics.avgDays} dni`} />
      </div>

      {isLoading ? (
        <div className="tl-card tl-centered">Ładowanie…</div>
      ) : (
        <div className="timeline-scroller" ref={scrollRef}>
          <div className="timeline-canvas" style={{ width: timelineWidth }}>
            <MonthAxis
              minDate={minDate}
              maxDate={maxDate}
              xFromDate={xFromDate}
            />
            <TodayMarker x={xFromDate(new Date())} />
            <Rows tasks={tasks} xFromDate={xFromDate} />
          </div>
        </div>
      )}

      {isFetching && (
        <div className="tl-muted" style={{ marginTop: 6 }}>
          Odświeżanie…
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function MonthAxis({
  minDate,
  maxDate,
  xFromDate,
}: {
  minDate: Date;
  maxDate: Date;
  xFromDate: (d: Date) => number;
}) {
  // wygeneruj segmenty miesięcy
  const months: { label: string; x: number; w: number }[] = [];
  let cur = startOfMonth(minDate);
  while (cur <= maxDate) {
    const end = endOfMonth(cur);
    const x = xFromDate(cur);
    const w = xFromDate(end) - xFromDate(cur) + 1 * 18; // mały zapas
    const label = cur.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    months.push({ label, x, w });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return (
    <div className="axis">
      {months.map((m, i) => (
        <div key={i} className="axis-cell" style={{ left: m.x, width: m.w }}>
          <span>{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function TodayMarker({ x }: { x: number }) {
  return <div className="today" style={{ left: x }} />;
}

function Rows({
  tasks,
  xFromDate,
}: {
  tasks: NormalizedTask[];
  xFromDate: (d: Date) => number;
}) {
  return (
    <div className="rows">
      {tasks.map((t) => (
        <Row key={t.id} task={t} xFromDate={xFromDate} />
      ))}
    </div>
  );
}

function Row({
  task,
  xFromDate,
}: {
  task: NormalizedTask;
  xFromDate: (d: Date) => number;
}) {
  const startX = xFromDate(task._start!);
  const endX = xFromDate(task._end!);
  const width = Math.max(6, endX - startX || 6);

  const pri: Priority = task.priority as any as Priority;
  const status: ColKey = (task.status as any as ColKey) ?? "todo";

  const bg =
    status === "done" ? "#16a34a" : status === "doing" ? "#f59e0b" : "#64748b"; // zielony / bursztyn / szary
  const outline =
    pri >= 3
      ? "2px solid #ef4444"
      : pri === 2
      ? "2px solid #eab308"
      : "1px solid rgba(0,0,0,.15)";

  return (
    <div className="row">
      <div className="row-title" title={task.title}>
        <a className="row-link" href={`/tasks?focus=${task.id}`}>
          {task.title}
        </a>
      </div>
      <div className="row-track">
        <div
          className="row-bar"
          style={{ left: startX, width, background: bg, border: outline }}
          title={tooltipFor(task)}
        />
      </div>
    </div>
  );
}

function tooltipFor(t: NormalizedTask) {
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString() : "–");
  const days = t._start && t._end ? daysBetween(t._start, t._end) : 0;
  const pr = t.priority as any;
  const status = (t.status as any) ?? "todo";
  return `${t.title}\n${fmt(t._start)} → ${fmt(
    t._end
  )} (${days} dni)\nStatus: ${String(status).toUpperCase()} | Priority: ${pr}`;
}

// ====== Wstrzyknięty CSS ======
function InlineStyles() {
  return (
    <style>{`
      .timeline-wrap{display:flex;flex-direction:column;gap:12px}
      .timeline-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
      .tl-input{min-width:260px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px}
      .tl-group{display:flex;align-items:center;gap:8px}
      .tl-label{color:#6b7280;font-size:12px}
      .tl-chip{padding:6px 10px;border-radius:16px;border:1px solid #e5e7eb;background:#fff;font-size:12px}
      .tl-chip.is-active{background:#111827;color:#fff;border-color:#111827}
      .tl-chip.prio-3.is-active{background:#ef4444;border-color:#ef4444}
      .tl-chip.prio-2.is-active{background:#eab308;border-color:#eab308;color:#111}
      .tl-link{background:none;border:none;color:#2563eb;font-size:12px;cursor:pointer}

      .timeline-metrics{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:10px}
      .metric{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px}
      .metric-value{font-weight:700;font-size:18px}
      .metric-label{color:#6b7280;font-size:12px}

      .timeline-scroller{position:relative;width:100%;overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa}
      .timeline-canvas{position:relative;min-height:520px}

      .axis{position:sticky;top:0;z-index:2;display:block;height:36px;border-bottom:1px solid #e5e7eb;background:linear-gradient(#fff,#fff);}
      .axis-cell{position:absolute;top:0;height:36px;border-left:1px dashed #e5e7eb;padding:8px 6px;box-sizing:border-box;color:#6b7280;font-size:12px;white-space:nowrap}

      .today{position:absolute;top:36px;bottom:0;width:2px;background:#ef4444;opacity:.9}

      .rows{position:relative;padding-top:12px}
      .row{display:grid;grid-template-columns:280px 1fr;align-items:center;min-height:46px;border-bottom:1px solid #f1f5f9}
      .row-title{padding:8px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .row-link{color:#111827;text-decoration:none}
      .row-link:hover{text-decoration:underline}
      .row-track{position:relative;height:34px}
      .row-bar{position:absolute;top:6px;height:22px;border-radius:6px;box-shadow:0 1px 0 rgba(0,0,0,.04)}

      .tl-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px}
      .tl-centered{display:flex;align-items:center;justify-content:center;height:240px}
      .tl-muted{color:#6b7280;font-size:12px}
    `}</style>
  );
}
