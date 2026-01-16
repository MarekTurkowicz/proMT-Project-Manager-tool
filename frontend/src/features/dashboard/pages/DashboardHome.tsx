import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./DashboardHome.css";

import type { LastActiveProject } from "../../types/dashboard";
import { LS_LAST_PROJECT } from "../../types/dashboard";

import { useMeQuery } from "../../auth/authApi";
import defaultAvatar from "../../../../assets/marek_img.png";

type ActivityPoint = {
  dayLabel: string;
  level: 0 | 1 | 2 | 3;
};

type HeatDay = {
  iso: string;
  weekdayShort: string;
  level: 0 | 1 | 2 | 3;
};

const LS_ACTIVITY = "app:activity";
const LS_ACTIVITY28 = "app:activity28";

export default function DashboardHome() {
  const { data: me } = useMeQuery();
  const display = me?.username ?? "User";

  const avatarUrl = defaultAvatar;

  const [lastProject, setLastProject] = useState<LastActiveProject | null>(
    null
  );
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [heatDays, setHeatDays] = useState<HeatDay[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(LS_LAST_PROJECT);
    if (raw) {
      try {
        setLastProject(JSON.parse(raw) as LastActiveProject);
      } catch {
        // ignore
      }
    }

    // ACTIVITY (fallback)
    const aRaw = localStorage.getItem(LS_ACTIVITY);
    if (aRaw) {
      try {
        setActivity(JSON.parse(aRaw) as ActivityPoint[]);
      } catch {
        // ignore
      }
    } else {
      setActivity(defaultActivity());
    }

    const hRaw = localStorage.getItem(LS_ACTIVITY28);
    if (hRaw) {
      try {
        const parsed = JSON.parse(hRaw) as HeatDay[];
        setHeatDays(parsed.slice(-28));
      } catch {
        setHeatDays(defaultHeatmap28());
      }
    } else {
      setHeatDays(defaultHeatmap28());
    }
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Dzień dobry";
    if (h < 18) return "Cześć";
    return "Dobry wieczór";
  }, []);

  const hasActivity = activity.length > 0;
  const hasHeat = heatDays.length > 0;

  return (
    <div className="dash-page">
      <header className="dash-hero">
        <div className="dash-hero__left">
          <h1 className="dash-title">
            {greeting}, <span className="dash-title__user">{display}</span> 👋
          </h1>
          <p className="dash-subtitle">
            To jest Twoja strona startowa. Wybierz, co chcesz zrobić dalej.
          </p>
        </div>

        <div className="dash-hero__right">
          <div className="user-card">
            <img
              className="user-card__avatarimg"
              src={avatarUrl}
              alt={display}
            />
            <div className="user-card__meta">
              <div className="user-card__name">{display}</div>
              <div className="user-card__muted">Workspace: PROMT</div>
            </div>
          </div>
        </div>
      </header>

      {/* GRID */}
      <div className="dash-grid">
        {/* LAST PROJECT */}
        <section className="dash-card">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Ostatnio używany projekt</h2>
            <span className="chip chip--gray">Szybki powrót</span>
          </div>

          {lastProject ? (
            <div className="last-project">
              <div className="last-project__top">
                <div className="last-project__info">
                  <div className="last-project__name">{lastProject.name}</div>

                  {lastProject.tagline ? (
                    <div className="last-project__tagline">
                      {lastProject.tagline}
                    </div>
                  ) : (
                    <div className="last-project__tagline muted">
                      Brak opisu — możesz dodać go w szczegółach projektu.
                    </div>
                  )}

                  <div className="last-project__meta">
                    {statusChip(lastProject.status)}
                    {activityChip(lastProject.activityLevel)}
                    <MiniActivityDots level={lastProject.activityLevel} />
                    <span className="meta-text">
                      • Ostatnia aktywność:{" "}
                      {formatRelative(lastProject.updatedAtISO)}
                    </span>
                  </div>
                </div>

                <div className="last-project__actions">
                  <Link className="btn" to="../projects">
                    Projekty
                  </Link>
                  <Link
                    className="btn-primary"
                    to={`../projects/${lastProject.id}/overview`}
                  >
                    Wróć do projektu →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Nie masz jeszcze ostatniego projektu"
              text="Utwórz pierwszy projekt albo przejdź do listy projektów."
              actions={
                <>
                  <Link className="btn-primary" to="../projects">
                    + Utwórz projekt
                  </Link>
                  <Link className="btn" to="../projects">
                    Przejdź do projektów →
                  </Link>
                </>
              }
            />
          )}
        </section>

        {/* AI */}
        <section className="dash-card dash-card--ai">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Asystent AI</h2>
            <span className="chip chip--amber">Wkrótce</span>
          </div>

          <p className="dash-ai__desc">
            W kolejnych wersjach agent AI pomoże planować, podsumowywać i
            sugerować kolejne kroki.
          </p>

          <div className="dash-ai__list">
            <FeatureRow text="Podsumowanie projektu w 1 klik" locked />
            <FeatureRow
              text="Sugestie kolejnych działań (Next best step)"
              locked
            />
            <FeatureRow text="Analiza rytmu pracy i nawyków" locked />
          </div>

          <div className="ai-footer">
            <button className="ai-try" disabled title="Funkcja w przygotowaniu">
              Wypróbuj AI
            </button>
            <button
              className="ai-more"
              onClick={() =>
                alert(
                  "Asystent AI jest w przygotowaniu. W kolejnych wersjach pojawi się podgląd działania."
                )
              }
              title="Zobacz zaplanowane funkcje"
            >
              Co będzie dostępne? →
            </button>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="dash-card dash-card--wide">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Szybkie skróty</h2>
            <span className="chip chip--sky">Skróty</span>
          </div>

          <div className="quick-actions">
            <QuickAction
              title="Projekty"
              desc="Przejdź do projektów i utwórz nowy."
              to="../projects"
              kind="primary"
              icon="📁"
            />
            <QuickAction
              title="Zadania"
              desc="Przejdź do zadań i utwórz nowe."
              to="../tasks"
              kind="default"
              icon="✅"
            />
            <QuickAction
              title="Finansowania"
              desc="Przejdź do finansowań i dodaj nowe."
              to="../fundings"
              kind="default"
              icon="💳"
            />
          </div>
        </section>

        {/* WORK RHYTHM */}
        <section className="dash-card dash-card--wide">
          <div className="dash-card__head">
            <h2 className="dash-card__title">Twój rytm pracy</h2>
            <span className="chip chip--gray">Ostatnie 4 tygodnie</span>
          </div>

          {hasActivity && hasHeat ? (
            <div className="workbox workbox--compact">
              {(() => {
                const ins = computeInsights(heatDays);

                return (
                  <div className="workbox__row">
                    <div className="workbox__left">
                      <div className="workbox__hint-inline muted">
                        Najedź na pole, aby zobaczyć dzień i poziom aktywności.
                      </div>
                      <WorkHeatmap days={heatDays.slice(-28)} />
                    </div>

                    <div className="workbox__right">
                      <div className="insights insights--col insights--two">
                        <InsightPill
                          icon="🧠"
                          title="Regularność"
                          value={ins.regularity}
                        />
                        <InsightPill
                          icon="⚡"
                          title="Najmocniejszy dzień"
                          value={ins.bestDay}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <EmptyState
              title="Brak aktywności"
              text="Zacznij od dodania pierwszego zadania albo utworzenia projektu."
              actions={
                <>
                  <Link className="btn-primary" to="../tasks">
                    + Dodaj zadanie
                  </Link>
                  <Link className="btn" to="../projects">
                    + Utwórz projekt
                  </Link>
                </>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* =======================
   UI helpers / components
======================= */

function EmptyState({
  title,
  text,
  actions,
}: {
  title: string;
  text: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden>
        ✨
      </div>
      <div className="empty__content">
        <div className="empty__title">{title}</div>
        <div className="empty__text">{text}</div>
        <div className="empty__actions">{actions}</div>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  desc,
  to,
  icon,
  kind,
}: {
  title: string;
  desc: string;
  to: string;
  icon: string;
  kind: "primary" | "default";
}) {
  return (
    <Link to={to} className={`qa ${kind === "primary" ? "qa--primary" : ""}`}>
      <div className="qa__icon" aria-hidden>
        {icon}
      </div>
      <div className="qa__body">
        <div className="qa__title">{title}</div>
        <div className="qa__desc">{desc}</div>
      </div>
      <div className="qa__arrow" aria-hidden>
        →
      </div>
    </Link>
  );
}

function FeatureRow({ text, locked }: { text: string; locked?: boolean }) {
  return (
    <div className={`feature ${locked ? "feature--locked" : ""}`}>
      <span className="feature__dot" aria-hidden />
      <span className="feature__text">{text}</span>
      {locked && <span className="feature__lock">🔒</span>}
    </div>
  );
}

function MiniActivityDots({ level }: { level: "low" | "medium" | "high" }) {
  const on = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <span className="mini-dots" aria-label={`Aktywność: ${level}`}>
      <span className={`mini-dot ${on >= 1 ? "on" : ""}`} />
      <span className={`mini-dot ${on >= 2 ? "on" : ""}`} />
      <span className={`mini-dot ${on >= 3 ? "on" : ""}`} />
    </span>
  );
}

function statusChip(status: "new" | "active" | "closed") {
  if (status === "active")
    return <span className="chip chip--green">AKTYWNY</span>;
  if (status === "closed")
    return <span className="chip chip--gray">ZAMKNIĘTY</span>;
  return <span className="chip chip--sky">NOWY</span>;
}

function activityChip(level: "low" | "medium" | "high") {
  const cls =
    level === "high"
      ? "chip--red"
      : level === "medium"
      ? "chip--amber"
      : "chip--gray";
  const txt =
    level === "high" ? "WYSOKA" : level === "medium" ? "ŚREDNIA" : "NISKA";
  return <span className={`chip ${cls}`}>{txt} AKTYWNOŚĆ</span>;
}

function formatRelative(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min temu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h temu`;
    const days = Math.floor(hours / 24);
    return `${days} dni temu`;
  } catch {
    return "niedawno";
  }
}

function defaultActivity(): ActivityPoint[] {
  return [
    { dayLabel: "Pn", level: 1 },
    { dayLabel: "Wt", level: 2 },
    { dayLabel: "Śr", level: 1 },
    { dayLabel: "Cz", level: 3 },
    { dayLabel: "Pt", level: 2 },
    { dayLabel: "Sb", level: 0 },
    { dayLabel: "Nd", level: 1 },
  ];
}

function getWeekdayShort(d: Date) {
  const map = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"] as const;
  return map[d.getDay()];
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultHeatmap28(): HeatDay[] {
  const out: HeatDay[] = [];
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const w = d.getDay();
    const base: 0 | 1 | 2 | 3 =
      w === 0
        ? 0
        : w === 6
        ? 1
        : Math.random() > 0.72
        ? 3
        : Math.random() > 0.45
        ? 2
        : 1;

    out.push({
      iso: toISODate(d),
      weekdayShort: getWeekdayShort(d),
      level: base,
    });
  }
  return out;
}

function computeInsights(days: HeatDay[]) {
  const activeDays = days.filter((d) => d.level > 0).length;
  const ratio = activeDays / Math.max(days.length, 1);

  const regularity =
    ratio >= 0.75
      ? "Regularny rytm"
      : ratio >= 0.45
      ? "Umiarkowany rytm"
      : "Nieregularny";

  const buckets = new Map<string, { sum: number; cnt: number }>();
  for (const d of days) {
    const b = buckets.get(d.weekdayShort) ?? { sum: 0, cnt: 0 };
    b.sum += d.level;
    b.cnt += 1;
    buckets.set(d.weekdayShort, b);
  }

  let bestDay = "—";
  let bestAvg = -1;
  for (const [k, v] of buckets.entries()) {
    const avg = v.sum / Math.max(v.cnt, 1);
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDay = k;
    }
  }

  return { regularity, bestDay };
}

function InsightPill({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="insight">
      <div className="insight__icon" aria-hidden>
        {icon}
      </div>
      <div className="insight__body">
        <div className="insight__title">{title}</div>
        <div className="insight__value">{value}</div>
      </div>
    </div>
  );
}

function WorkHeatmap({ days }: { days: HeatDay[] }) {
  const weeks = [
    days.slice(0, 7),
    days.slice(7, 14),
    days.slice(14, 21),
    days.slice(21, 28),
  ];
  const headers = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

  return (
    <div className="heatmap">
      <div className="heatmap__header" aria-hidden>
        {headers.map((h) => (
          <div key={h} className="heatmap__hcell">
            {h}
          </div>
        ))}
      </div>

      <div
        className="heatmap__grid"
        role="grid"
        aria-label="Heatmap aktywności z 4 tygodni"
      >
        {weeks.map((w, wi) => (
          <div className="heatmap__row" role="row" key={wi}>
            {w.map((d) => (
              <div
                key={d.iso}
                role="gridcell"
                className={`heatmap__cell l${d.level}`}
                title={`${d.weekdayShort} • ${d.iso} • ${levelLabel(d.level)}`}
                aria-label={`${d.weekdayShort} ${d.iso} ${levelLabel(d.level)}`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="heatmap__legend">
        <span className="muted">Niska</span>
        <span className="heatmap__dot l0" />
        <span className="heatmap__dot l1" />
        <span className="heatmap__dot l2" />
        <span className="heatmap__dot l3" />
        <span className="muted">Wysoka</span>
      </div>
    </div>
  );
}

function levelLabel(l: 0 | 1 | 2 | 3) {
  if (l === 0) return "brak aktywności";
  if (l === 1) return "niska aktywność";
  if (l === 2) return "średnia aktywność";
  return "wysoka aktywność";
}
