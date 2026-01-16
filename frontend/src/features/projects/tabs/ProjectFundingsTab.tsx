import { useEffect, useMemo, useState } from "react";
import { useProject } from "../context/ProjectContext";

import {
  useListFundingsQuery,
  usePickFundingsQuery,
  useCreateFundingMutation,
} from "../../api/fundingApi";
import {
  useListProjectFundingsQuery,
  useCreateProjectFundingMutation,
  useDeleteProjectFundingMutation,
} from "../../api/projectFundingApi";

import { useListTasksQuery } from "../../tasks/tasksApi";
import type { TasksListParams } from "../../tasks/tasksApi";

import type { Funding, FundingCreate } from "../../types/funding";
import type { Task } from "../../tasks/types";

import AddFundingModal from "../../fundings/components/AddFundingModal";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

import "./ProjectFundingsTab.css";

type FundingBarItem = {
  name: string;
  value: number;
};

type FundingStatusKey = "active" | "upcoming" | "finished";

type AmountByStatusItem = {
  status: FundingStatusKey;
  label: string;
  value: number;
};

type BudgetChartMode = "coverage" | "top" | "status";

type ProjectFundingLink = {
  id: number;
  project: number;
  funding: number;
};

type DeadlineItem = {
  fundingId: number;
  name: string;
  reportingDeadline: string;
  date: Date;
};

type EndingSoonItem = {
  fundingId: number;
  name: string;
  endDate: string;
  date: Date;
};

type PerFundingCompletion = {
  fundingId: number;
  name: string;
  done: number;
  total: number;
  pct: number;
};

type ScopedTask = Task & {
  scope_project_funding?: number | null;
};

type FundingStatus = "active" | "upcoming" | "finished" | "nodates";

type StatusFilter = "all" | "active" | "upcoming" | "finished" | "risk";

type FundingStats = {
  totalCount: number;
  totalAmount: number | null;
  currencyLabel: string;

  activeCount: number;
  upcomingCount: number;
  finishedCount: number;

  amountBars: FundingBarItem[];
  amountByStatus: AmountByStatusItem[];

  upcomingDeadlines: DeadlineItem[];

  withAmountCount: number;
  withDatesCount: number;
  withReportingCount: number;

  largestFundingName: string | null;
  largestFundingAmount: number | null;
  largestFundingCurrency: string | null;
  largestFundingSharePct: number | null;
};

type RiskStats = {
  atRiskCount: number;
  atRiskIds: number[];
  endingSoonItems: EndingSoonItem[];
  nextReportingDays: number | null;
};

type CoverageStatus =
  | "nodata"
  | "nocosts"
  | "nofunding"
  | "covered"
  | "underfunded";

/* Tłumaczenia (UI PL) */

const PL = {
  // KPI / nagłówki
  fundings: "Źródła finansowania",
  totalBudget: "Łączny budżet",
  dataCompleteness: "Kompletność danych",
  fundingHealth: "Kondycja finansowania",
  linkFunding: "Podepnij finansowanie",

  // KPI meta / opisy
  noFundingsLinkedYet: "Brak podpiętych źródeł finansowania",
  sumOfLinkedWithAmount:
    "Suma wszystkich podpiętych źródeł z uzupełnioną kwotą",
  amount: "Kwota",
  dates: "Daty",
  reporting: "Raportowanie",

  // statusy / filtry
  linkedFundings: "Podpięte finansowania",
  all: "Wszystkie",
  active: "Aktywne",
  upcoming: "Nadchodzące",
  finished: "Zakończone",
  atRisk: "Ryzykowne",

  // ładowanie / puste stany
  loadingFundings: "Ładowanie finansowań…",
  refreshing: "Odświeżanie…",
  noFundingsLinkedTitle: "Brak podpiętych finansowań",
  noFundingsLinkedText:
    "Podepnij co najmniej jedno źródło finansowania albo dodaj nowe, aby zobaczyć podsumowanie budżetu projektu.",
  noFundingsMatchingFilter: "Brak finansowań spełniających aktualny filtr.",
  noDataYet: "Brak danych.",
  noAmountDataToVisualise: "Brak danych o kwotach do wizualizacji.",

  // linkowanie
  selectFunding: "Wybierz finansowanie…",
  allAlreadyLinked: "Wszystkie finansowania są już podpięte",
  linking: "Podpinanie…",
  link: "Podepnij",
  newFunding: "Nowe finansowanie",

  // confirm unlink
  unlinkConfirm:
    "Odpiąć to finansowanie od projektu? Skopiowane zadania w ramach finansowania zostaną usunięte.",
  unlinking: "Odpinanie…",
  unlink: "Odepnij",

  // prawa kolumna / sekcje
  budget: "Budżet",
  coverage: "Pokrycie",
  topByAmount: "Top wg kwoty",
  byStatus: "Wg statusu",

  highlights: "Podsumowanie",
  largestFunding: "Największe finansowanie",
  shareOfTotalBudget: "Udział w łącznym budżecie",
  fundingsAtRisk: "Finansowania ryzykowne",
  activeBudget: "Budżet aktywny",

  // deadlines
  upcomingReports: "Nadchodzące raporty",
  noUpcomingReportingDeadlines: "Brak nadchodzących terminów raportowania.",
  endingSoon: "Kończą się wkrótce (< 30 dni)",
  noEndingSoon: "Brak finansowań kończących się w ciągu 30 dni.",

  // coverage UI
  coveredChip: "Pokryte",
  coveredText: "Aktualne finansowanie pokrywa obecne koszty zadań.",
  overBudgetChip: "Ponad budżet",
  overBudgetText:
    "Koszty zadań są wyższe niż łączna kwota finansowania — projekt jest ponad budżet.",
  noFundingChip: "Brak finansowania",
  noFundingText: "Zadania mają koszty, ale nie ma podpiętego finansowania.",
  noCostsChip: "Brak kosztów",
  noCostsText: "Finansowanie istnieje, ale brak zadań z kosztami.",
  noDataChip: "Brak danych",
  noDataText: "Na razie brak finansowania i brak kosztów zadań.",

  // wykres / legenda
  valuesIn: "Wartości w",

  // funding row
  noDates: "Brak dat",
  watch: "Do obserwacji",
  healthy: "OK",
  noTasks: "Brak zadań",
  show: "Pokaż",
  hide: "Ukryj",
  noTasksYet: "Brak zadań",
  allTasksDone: "Wszystkie zrobione",
  doneOf: (done: number, total: number) => `${done}/${total} zrobione`,

  // akordeon body
  tasksInThisProject: "Zadania w tym projekcie",
  tasksCount: (n: number) => `${n} zadań`,
  tasksCountRefreshing: (n: number) => `${n} zadań (odświeżanie…)`,
  openInTasks: "Otwórz w Zadaniach",
  loadingTasks: "Ładowanie zadań…",
  noTasksYetHint:
    "Brak zadań — pojawią się tutaj po podpięciu zadań szablonowych lub utworzeniu zadań projektu dla tego finansowania.",

  due: "Termin",
  reportingLabel: "Raportowanie",
  ends: "Koniec",
  fundingsLabel: "Finansowania",
  taskCosts: "Koszty zadań",
} as const;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(diff / msPerDay);
}

function fmtDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getFundingStatus(f: Funding, today: Date): FundingStatus {
  const s = parseDate(f.start_date);
  const e = parseDate(f.end_date);

  if (!s && !e) return "nodates";

  const t = startOfDay(today).getTime();

  if (s && !e) {
    return startOfDay(s).getTime() > t ? "upcoming" : "active";
  }
  if (!s && e) {
    return startOfDay(e).getTime() < t ? "finished" : "active";
  }
  if (s && e) {
    const ss = startOfDay(s).getTime();
    const ee = startOfDay(e).getTime();
    if (t < ss) return "upcoming";
    if (t > ee) return "finished";
    return "active";
  }
  return "nodates";
}

function humanizeDaysDiffPL(diff: number | null): string {
  if (diff == null) return "Brak nadchodzących raportów";
  if (diff === 0) return "Najbliższy raport: dziś";
  if (diff === 1) return "Najbliższy raport: za 1 dzień";
  return `Najbliższy raport: za ${diff} dni`;
}

function timelineLabelPL(endDiff: number): string {
  if (endDiff < 0) return `Zakończone ${Math.abs(endDiff)} dni temu`;
  if (endDiff === 0) return "Kończy się dziś";
  if (endDiff === 1) return "Kończy się za 1 dzień";
  return `Kończy się za ${endDiff} dni`;
}

function reportLabelPL(reportDiff: number): string {
  if (reportDiff < 0) return `Raport spóźniony o ${Math.abs(reportDiff)} dni`;
  if (reportDiff === 0) return "Raport na dziś";
  if (reportDiff === 1) return "Raport za 1 dzień";
  return `Raport za ${reportDiff} dni`;
}

/**
 * Budżet zadania – liczymy po cost_amount (string z DRF Decimala).
 */
function getTaskBudget(task: Task): number {
  if (!task.cost_amount) return 0;
  const num = Number(task.cost_amount);
  if (Number.isNaN(num)) return 0;
  return num;
}

const BUDGET_MODE_STORAGE_KEY = "pft_budget_mode_v1";

/* ─────────────────────────────
 *  GŁÓWNY KOMPONENT
 * ───────────────────────────── */

export default function ProjectFundingsTab() {
  const project = useProject();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [budgetChartMode, setBudgetChartMode] = useState<BudgetChartMode>(
    () => {
      try {
        const raw = window.localStorage.getItem(BUDGET_MODE_STORAGE_KEY);
        if (raw === "coverage" || raw === "top" || raw === "status") return raw;
      } catch {
        // noop
      }
      return "coverage";
    }
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(BUDGET_MODE_STORAGE_KEY, budgetChartMode);
    } catch {
      // noop
    }
  }, [budgetChartMode]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ── FUNDINGS DLA TEGO PROJEKTU ─────────────────────

  const fundingQueryArg = useMemo(
    () => ({
      project: project.id,
      ordering: "name" as const,
    }),
    [project.id]
  );

  const {
    data: fundingsPage,
    isLoading: isFundingsLoading,
    isFetching: isFundingsFetching,
    refetch: refetchFundings,
  } = useListFundingsQuery(fundingQueryArg);

  const linkedFundings: Funding[] = useMemo(
    () => fundingsPage?.results ?? [],
    [fundingsPage]
  );

  const hasFundings = linkedFundings.length > 0;

  // ── PROJECT_FUNDINGS ─────────────────────

  const { data: projectFundingsPage, refetch: refetchProjectFundings } =
    useListProjectFundingsQuery({ project: project.id });

  const projectFundings: ProjectFundingLink[] = useMemo(
    () =>
      (projectFundingsPage as { results?: ProjectFundingLink[] } | undefined)
        ?.results ??
      (projectFundingsPage as ProjectFundingLink[] | undefined) ??
      [],
    [projectFundingsPage]
  );

  const pfByFundingId = useMemo(() => {
    const map = new Map<number, ProjectFundingLink>();
    projectFundings.forEach((pf) => map.set(pf.funding, pf));
    return map;
  }, [projectFundings]);

  const pfById = useMemo(() => {
    const map = new Map<number, ProjectFundingLink>();
    projectFundings.forEach((pf) => map.set(pf.id, pf));
    return map;
  }, [projectFundings]);

  // ── PICK FUNDINGS (select do linkowania + modal) ─────────────────────

  const { data: allFundings = [], refetch: refetchPickFundings } =
    usePickFundingsQuery();

  const availableFundings = useMemo(() => {
    const linkedIds = new Set(linkedFundings.map((f) => f.id));
    return allFundings.filter((f) => !linkedIds.has(f.id));
  }, [allFundings, linkedFundings]);

  const [selectedFundingId, setSelectedFundingId] = useState<number | "">("");

  const [createProjectFunding, { isLoading: isLinking }] =
    useCreateProjectFundingMutation();
  const [deleteProjectFunding, { isLoading: isUnlinking }] =
    useDeleteProjectFundingMutation();

  async function handleLinkFunding() {
    if (!selectedFundingId || typeof selectedFundingId !== "number") return;
    try {
      await createProjectFunding({
        project: project.id,
        funding: selectedFundingId,
      }).unwrap();
      setSelectedFundingId("");
      await Promise.all([refetchFundings(), refetchProjectFundings()]);
    } catch (e) {
      console.error("Failed to link funding", e);
    }
  }

  async function handleUnlinkFunding(fundingId: number) {
    const link = pfByFundingId.get(fundingId);
    if (!link) return;

    const ok = window.confirm(PL.unlinkConfirm);
    if (!ok) return;

    try {
      await deleteProjectFunding(link.id).unwrap();
      await Promise.all([refetchFundings(), refetchProjectFundings()]);
    } catch (e) {
      console.error("Failed to unlink funding", e);
    }
  }

  // ── MODAL NOWEGO FUNDING ─────────────────────

  const [openAddFunding, setOpenAddFunding] = useState(false);
  const [createFunding] = useCreateFundingMutation();

  async function handleCreateFunding(payload: FundingCreate) {
    try {
      await createFunding(payload).unwrap();
      await refetchPickFundings();
      setOpenAddFunding(false);
    } catch (e) {
      console.error("Failed to create funding", e);
    }
  }

  // ── KPI + PODSTAWOWE STATY ─────────────────────

  const {
    totalCount,
    totalAmount,
    currencyLabel,
    activeCount,
    upcomingCount,
    finishedCount,
    amountBars,
    amountByStatus,
    upcomingDeadlines,
    withAmountCount,
    withDatesCount,
    withReportingCount,
    largestFundingName,
    largestFundingAmount,
    largestFundingCurrency,
    largestFundingSharePct,
  } = useMemo<FundingStats>(() => {
    const count = linkedFundings.length;

    let mainCurrency = "PLN";
    const numericAmounts: number[] = [];

    let active = 0;
    let upcoming = 0;
    let finished = 0;

    let activeAmount = 0;
    let upcomingAmount = 0;
    let finishedAmount = 0;

    let topName: string | null = null;
    let topAmount: number | null = null;
    let topCurrency: string | null = null;

    let withAmount = 0;
    let withDates = 0;
    let withReporting = 0;

    linkedFundings.forEach((f) => {
      if (f.currency) mainCurrency = f.currency;

      const status = getFundingStatus(f, today);
      if (status === "active") active += 1;
      else if (status === "upcoming") upcoming += 1;
      else if (status === "finished") finished += 1;

      const hasAmount = f.amount_total != null;
      const amountNum = hasAmount ? Number(f.amount_total) : null;

      if (hasAmount && amountNum != null && !Number.isNaN(amountNum)) {
        withAmount += 1;
        numericAmounts.push(amountNum);

        if (status === "active") activeAmount += amountNum;
        else if (status === "upcoming") upcomingAmount += amountNum;
        else if (status === "finished") finishedAmount += amountNum;

        if (topAmount == null || amountNum > topAmount) {
          topAmount = amountNum;
          topName = f.name;
          topCurrency = f.currency ?? mainCurrency;
        }
      }

      if (f.start_date && f.end_date) withDates += 1;
      if (f.reporting_deadline) withReporting += 1;
    });

    const sumAmount: number | null =
      numericAmounts.length > 0
        ? numericAmounts.reduce((acc, v) => acc + v, 0)
        : null;

    const amountBarsArr: FundingBarItem[] = linkedFundings
      .map((f): FundingBarItem => {
        const amt = f.amount_total != null ? Number(f.amount_total) : 0;
        return {
          name: f.name,
          value: Number.isNaN(amt) ? 0 : amt,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const upcomingDeadlinesArr: DeadlineItem[] = linkedFundings
      .filter((f) => f.reporting_deadline)
      .map(
        (f): DeadlineItem => ({
          fundingId: f.id,
          name: f.name,
          reportingDeadline: f.reporting_deadline as string,
          date: parseDate(f.reporting_deadline)!,
        })
      )
      .filter((x) => x.date && startOfDay(x.date) >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);

    const rawAmountByStatus: AmountByStatusItem[] = [
      { status: "active", label: PL.active, value: activeAmount },
      { status: "upcoming", label: PL.upcoming, value: upcomingAmount },
      { status: "finished", label: PL.finished, value: finishedAmount },
    ];

    const amountByStatusArr = rawAmountByStatus.filter(
      (item) => item.value > 0
    );

    const largestSharePct =
      sumAmount != null && sumAmount > 0 && topAmount != null
        ? Math.round((topAmount / sumAmount) * 100)
        : null;

    return {
      totalCount: count,
      totalAmount: sumAmount,
      currencyLabel: mainCurrency,
      activeCount: active,
      upcomingCount: upcoming,
      finishedCount: finished,
      amountBars: amountBarsArr,
      amountByStatus: amountByStatusArr,
      upcomingDeadlines: upcomingDeadlinesArr,
      withAmountCount: withAmount,
      withDatesCount: withDates,
      withReportingCount: withReporting,
      largestFundingName: topName,
      largestFundingAmount: topAmount,
      largestFundingCurrency: topCurrency,
      largestFundingSharePct: largestSharePct,
    };
  }, [linkedFundings, today]);

  const completenessPct = useMemo(() => {
    if (totalCount === 0) return 0;
    const max = totalCount * 3;
    const filled = withAmountCount + withDatesCount + withReportingCount;
    return Math.round((filled / max) * 100);
  }, [totalCount, withAmountCount, withDatesCount, withReportingCount]);

  // ── TASKI FUNDING-SCOPED (do KPI i risk) ─────────────────────

  const fundingTasksArg = useMemo(
    () =>
      ({
        project: project.id,
        funding_scoped: "1",
        ordering: "-created_at" as const,
      } as TasksListParams),
    [project.id]
  );

  const { data: fundingTasksPage } = useListTasksQuery(fundingTasksArg);

  const fundingScopedTasks: Task[] = useMemo(
    () => fundingTasksPage?.results ?? [],
    [fundingTasksPage]
  );

  const { totalFundingTasks, fundingCompletionPct, perFundingCompletion } =
    useMemo(() => {
      const stats = new Map<number, { total: number; done: number }>();

      fundingScopedTasks.forEach((t) => {
        const task = t as ScopedTask;
        const pfId = task.scope_project_funding ?? null;
        if (!pfId) return;
        const pf = pfById.get(pfId);
        if (!pf) return;
        const fundingId = pf.funding;

        const entry = stats.get(fundingId) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (t.status === "done") entry.done += 1;
        stats.set(fundingId, entry);
      });

      const perFunding: PerFundingCompletion[] = linkedFundings.map((f) => {
        const s = stats.get(f.id) ?? { total: 0, done: 0 };
        const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
        return {
          fundingId: f.id,
          name: f.name,
          total: s.total,
          done: s.done,
          pct,
        };
      });

      const totals = Array.from(stats.values()).reduce(
        (acc, s) => {
          acc.total += s.total;
          acc.done += s.done;
          return acc;
        },
        { total: 0, done: 0 }
      );

      const pct =
        totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

      return {
        totalFundingTasks: totals.total,
        fundingCompletionPct: pct,
        perFundingCompletion: perFunding,
      };
    }, [fundingScopedTasks, pfById, linkedFundings]);

  // ── TASKI PROJEKTU (do coverage: fundings vs task cost) ─────────────────────

  const projectTasksArg = useMemo(
    () =>
      ({
        project: project.id,
        ordering: "-created_at" as const,
      } as TasksListParams),
    [project.id]
  );

  const { data: projectTasksPage } = useListTasksQuery(projectTasksArg);

  const projectTasks: Task[] = useMemo(
    () => projectTasksPage?.results ?? [],
    [projectTasksPage]
  );

  const { taskCostTotal, coverageStatus, coveragePct, coveragePieData } =
    useMemo(() => {
      const totalTaskCost = projectTasks.reduce(
        (acc, t) => acc + getTaskBudget(t),
        0
      );

      let status: CoverageStatus = "nodata";
      let pct: number | null = null;

      if (totalTaskCost === 0 && (!totalAmount || totalAmount === 0))
        status = "nodata";
      else if (totalTaskCost === 0) status = "nocosts";
      else if (!totalAmount || totalAmount === 0) status = "nofunding";
      else if (totalAmount >= totalTaskCost) status = "covered";
      else status = "underfunded";

      if (totalTaskCost > 0 && totalAmount != null) {
        const coveredValue = Math.min(totalAmount, totalTaskCost);
        pct = Math.round((coveredValue / totalTaskCost) * 100);
      }

      const fundingVal = totalAmount ?? 0;
      const costsVal = totalTaskCost;

      const pieData =
        fundingVal === 0 && costsVal === 0
          ? []
          : [
              { name: PL.fundingsLabel, value: fundingVal },
              { name: PL.taskCosts, value: costsVal },
            ];

      return {
        taskCostTotal: totalTaskCost,
        coverageStatus: status,
        coveragePct: pct,
        coveragePieData: pieData,
      };
    }, [projectTasks, totalAmount]);

  const coverageUi = useMemo(() => {
    if (coverageStatus === "covered") {
      return {
        chip: PL.coveredChip,
        chipClass: "pft-coverage-chip-covered",
        text: PL.coveredText,
      };
    }
    if (coverageStatus === "underfunded") {
      return {
        chip: PL.overBudgetChip,
        chipClass: "pft-coverage-chip-under",
        text: PL.overBudgetText,
      };
    }
    if (coverageStatus === "nofunding") {
      return {
        chip: PL.noFundingChip,
        chipClass: "pft-coverage-chip-muted",
        text: PL.noFundingText,
      };
    }
    if (coverageStatus === "nocosts") {
      return {
        chip: PL.noCostsChip,
        chipClass: "pft-coverage-chip-muted",
        text: PL.noCostsText,
      };
    }
    return {
      chip: PL.noDataChip,
      chipClass: "pft-coverage-chip-muted",
      text: PL.noDataText,
    };
  }, [coverageStatus]);

  // ── RISK & DUE ANALYTICS ─────────────────────

  const { atRiskCount, atRiskIds, endingSoonItems, nextReportingDays } =
    useMemo<RiskStats>(() => {
      const completionMap = new Map<number, PerFundingCompletion>();
      perFundingCompletion.forEach((p) => completionMap.set(p.fundingId, p));

      let atRisk = 0;
      const atRiskIdsAcc: number[] = [];

      const endingSoonAcc: EndingSoonItem[] = [];
      const upcomingReportDiffs: number[] = [];

      linkedFundings.forEach((f) => {
        const start = parseDate(f.start_date);
        const end = parseDate(f.end_date);
        const report = parseDate(f.reporting_deadline);
        const completionPct = completionMap.get(f.id)?.pct ?? 0;

        let endSoon = false;
        if (end) {
          const diff = daysBetween(today, end);
          if (diff >= 0 && diff <= 30) {
            endSoon = true;
            endingSoonAcc.push({
              fundingId: f.id,
              name: f.name,
              endDate: f.end_date as string,
              date: end,
            });
          }
        }

        let reportSoon = false;
        if (report) {
          const diff = daysBetween(today, report);
          if (diff >= 0) {
            upcomingReportDiffs.push(diff);
            if (diff <= 14) reportSoon = true;
          }
        }

        const missingBasics = !f.amount_total || !start || !end;
        const hasOverdueReport =
          report != null && daysBetween(report, today) > 0;

        const isAtRiskFunding =
          (endSoon || reportSoon || missingBasics || hasOverdueReport) &&
          completionPct < 100;

        if (isAtRiskFunding) {
          atRisk += 1;
          atRiskIdsAcc.push(f.id);
        }
      });

      const nextReport =
        upcomingReportDiffs.length > 0
          ? Math.min(...upcomingReportDiffs)
          : null;

      return {
        atRiskCount: atRisk,
        atRiskIds: atRiskIdsAcc,
        endingSoonItems: endingSoonAcc.sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        ),
        nextReportingDays: nextReport,
      };
    }, [linkedFundings, perFundingCompletion, today]);

  const nextReportingLabel = humanizeDaysDiffPL(nextReportingDays);

  // ── LISTA PO FILTRACH STATUSU ─────────────────────

  const displayFundings = useMemo(() => {
    if (!hasFundings) return [] as Funding[];
    const atRiskSet = new Set(atRiskIds);
    return linkedFundings.filter((f) => {
      const status = getFundingStatus(f, today);
      if (statusFilter === "all") return true;
      if (statusFilter === "risk") return atRiskSet.has(f.id);
      if (status === "nodates") return false;
      return status === statusFilter;
    });
  }, [linkedFundings, hasFundings, statusFilter, atRiskIds, today]);

  const activeAmount =
    amountByStatus.find((s) => s.status === "active")?.value ?? 0;

  const activeBudgetPct =
    totalAmount != null && totalAmount > 0
      ? Math.round((activeAmount / totalAmount) * 100)
      : null;

  const atRiskPct =
    totalCount > 0 ? Math.round((atRiskCount / totalCount) * 100) : 0;

  // ─────────────────────────────
  //  RENDER
  // ─────────────────────────────

  return (
    <div className="pft-root">
      <AddFundingModal
        open={openAddFunding}
        onClose={() => setOpenAddFunding(false)}
        onSubmit={handleCreateFunding}
      />

      {/* KPI STRIP */}
      <div className="card pft-kpi-strip">
        <div className="pft-kpi-item">
          <div className="pft-kpi-label">{PL.fundings}</div>
          <div className="pft-kpi-value">{totalCount}</div>
          <div className="pft-kpi-meta">
            {totalCount === 0
              ? PL.noFundingsLinkedYet
              : `${activeCount} ${PL.active.toLowerCase()} • ${upcomingCount} ${PL.upcoming.toLowerCase()} • ${finishedCount} ${PL.finished.toLowerCase()}`}
          </div>
        </div>

        <div className="pft-kpi-item">
          <div className="pft-kpi-label">{PL.totalBudget}</div>
          <div className="pft-kpi-value">
            {totalAmount != null
              ? `${totalAmount.toLocaleString()} ${currencyLabel}`
              : "—"}
          </div>
          <div className="pft-kpi-meta">{PL.sumOfLinkedWithAmount}</div>
        </div>

        <div className="pft-kpi-item">
          <div className="pft-kpi-label">{PL.dataCompleteness}</div>
          <div className="pft-kpi-value">
            {totalCount === 0 ? "—" : `${completenessPct}%`}
          </div>
          <div className="pft-kpi-meta-lines">
            <span>
              {PL.amount}:{" "}
              <strong>
                {withAmountCount}/{totalCount || 0}
              </strong>
            </span>
            <span>
              {PL.dates}:{" "}
              <strong>
                {withDatesCount}/{totalCount || 0}
              </strong>
            </span>
            <span>
              {PL.reporting}:{" "}
              <strong>
                {withReportingCount}/{totalCount || 0}
              </strong>
            </span>
          </div>
        </div>

        <div className="pft-kpi-item">
          <div className="pft-kpi-label">{PL.fundingHealth}</div>
          <div className="pft-kpi-value">
            {atRiskCount > 0
              ? `${atRiskCount} ${PL.atRisk.toLowerCase()}`
              : totalFundingTasks === 0
              ? PL.noTasks
              : PL.healthy}
          </div>
          <div className="pft-kpi-meta">
            {totalFundingTasks === 0
              ? "Brak zadań przypisanych do finansowań"
              : `Zrobione: ${fundingCompletionPct}% zadań finansowania`}
            <br />
            {nextReportingLabel}
          </div>
        </div>

        <div className="pft-kpi-item pft-kpi-link">
          <div className="pft-kpi-label">{PL.linkFunding}</div>
          <div className="pft-kpi-link-row">
            <select
              className="pft-select"
              value={selectedFundingId}
              onChange={(e) =>
                setSelectedFundingId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <option value="">
                {availableFundings.length > 0
                  ? PL.selectFunding
                  : PL.allAlreadyLinked}
              </option>
              {availableFundings.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn pft-link-btn"
              onClick={handleLinkFunding}
              disabled={
                !selectedFundingId ||
                typeof selectedFundingId !== "number" ||
                isLinking ||
                availableFundings.length === 0
              }
            >
              {isLinking ? PL.linking : PL.link}
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary pft-kpi-new-btn"
            onClick={() => setOpenAddFunding(true)}
          >
            {PL.newFunding}
          </button>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="pft-layout">
        {/* LEWA KOLUMNA */}
        <div className="pft-main">
          <div className="card pft-list-card">
            <div className="pft-list-head">
              <h3 className="pft-list-title">{PL.linkedFundings}</h3>
              {isFundingsFetching && (
                <span className="pft-badge pft-badge-muted">
                  {PL.refreshing}
                </span>
              )}
            </div>

            <div className="pft-status-filters">
              {(
                [
                  ["all", PL.all],
                  ["active", PL.active],
                  ["upcoming", PL.upcoming],
                  ["finished", PL.finished],
                  ["risk", PL.atRisk],
                ] as [StatusFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    "pft-status-filter" +
                    (statusFilter === key ? " is-active" : "")
                  }
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                  {key === "risk" && atRiskCount > 0 && (
                    <span className="pft-status-count">{atRiskCount}</span>
                  )}
                </button>
              ))}
            </div>

            {isFundingsLoading ? (
              <div className="pft-empty">{PL.loadingFundings}</div>
            ) : !hasFundings ? (
              <div className="pft-empty">
                <div className="pft-empty-title">
                  {PL.noFundingsLinkedTitle}
                </div>
                <div className="pft-empty-text">{PL.noFundingsLinkedText}</div>
              </div>
            ) : displayFundings.length === 0 ? (
              <div className="pft-empty">{PL.noFundingsMatchingFilter}</div>
            ) : (
              <div className="pft-funding-scroll">
                <ul className="pft-funding-list">
                  {displayFundings.map((f) => {
                    const status = getFundingStatus(f, today);
                    const isAtRisk = atRiskIds.includes(f.id);
                    return (
                      <FundingAccordionRow
                        key={f.id}
                        funding={f}
                        projectId={project.id}
                        projectFundingId={pfByFundingId.get(f.id)?.id ?? null}
                        status={status}
                        isAtRisk={isAtRisk}
                        today={today}
                        onUnlink={() => handleUnlinkFunding(f.id)}
                        unlinkDisabled={isUnlinking}
                      />
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* PRAWA KOLUMNA */}
        <div className="pft-side">
          {/* BUDGET (Coverage + 2 charts) */}
          <div className="card pft-side-card">
            <div className="pft-section-header">
              <h3>{PL.budget}</h3>
            </div>

            <div className="pft-chart-tabs">
              <button
                type="button"
                className={
                  "pft-chart-tab" +
                  (budgetChartMode === "coverage" ? " is-active" : "")
                }
                onClick={() => setBudgetChartMode("coverage")}
              >
                {PL.coverage}
              </button>
              <button
                type="button"
                className={
                  "pft-chart-tab" +
                  (budgetChartMode === "top" ? " is-active" : "")
                }
                onClick={() => setBudgetChartMode("top")}
              >
                {PL.topByAmount}
              </button>
              <button
                type="button"
                className={
                  "pft-chart-tab" +
                  (budgetChartMode === "status" ? " is-active" : "")
                }
                onClick={() => setBudgetChartMode("status")}
              >
                {PL.byStatus}
              </button>
            </div>

            {budgetChartMode === "coverage" && (
              <>
                {coveragePieData.length === 0 ? (
                  <div className="pft-empty">{PL.noDataText}</div>
                ) : (
                  <div className="pft-coverage-inner">
                    <div className="pft-completion-top">
                      <div className="pft-completion-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={coveragePieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={32}
                              outerRadius={48}
                              paddingAngle={3}
                            >
                              {coveragePieData.map((entry, idx) => (
                                <Cell
                                  key={entry.name}
                                  fill={idx === 0 ? "#3b82f6" : "#f97316"}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>

                        <div className="pft-completion-center">
                          <div className="pft-completion-pct">
                            {coveragePct != null ? `${coveragePct}%` : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="pft-completion-meta">
                        <div className="pft-completion-line">
                          <span className="pft-completion-key">
                            {PL.fundingsLabel}
                          </span>
                          <span className="pft-completion-val">
                            {totalAmount != null
                              ? `${totalAmount.toLocaleString()} ${currencyLabel}`
                              : `0 ${currencyLabel}`}
                          </span>
                        </div>
                        <div className="pft-completion-line">
                          <span className="pft-completion-key">
                            {PL.taskCosts}
                          </span>
                          <span className="pft-completion-val">
                            {taskCostTotal.toLocaleString()} {currencyLabel}
                          </span>
                        </div>

                        <div className="pft-coverage-status">
                          <span
                            className={`pft-coverage-chip ${coverageUi.chipClass}`}
                          >
                            {coverageUi.chip}
                          </span>
                          <span className="pft-coverage-text">
                            {coverageUi.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {budgetChartMode === "top" && (
              <>
                {!hasFundings ? (
                  <div className="pft-empty">{PL.noDataYet}</div>
                ) : amountBars.length === 0 ? (
                  <div className="pft-empty">{PL.noAmountDataToVisualise}</div>
                ) : (
                  <div className="pft-chart-inner">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart
                        data={amountBars}
                        layout="vertical"
                        margin={{ left: 12, right: 16, top: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tickFormatter={(v) =>
                            (v as number) >= 1000
                              ? `${Math.round((v as number) / 1000)}k`
                              : String(v)
                          }
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={88}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip />
                        <Bar dataKey="value" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="pft-chart-legend">
                      <span className="pft-chart-legend-item">
                        {PL.valuesIn} <strong>{currencyLabel}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {budgetChartMode === "status" && (
              <>
                {!hasFundings ? (
                  <div className="pft-empty">{PL.noDataYet}</div>
                ) : amountByStatus.length === 0 ? (
                  <div className="pft-empty">{PL.noAmountDataToVisualise}</div>
                ) : (
                  <div className="pft-chart-inner">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart
                        data={amountByStatus}
                        margin={{ left: 24, right: 16, top: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis
                          allowDecimals={false}
                          tickFormatter={(v) =>
                            (v as number) >= 1000
                              ? `${Math.round((v as number) / 1000)}k`
                              : String(v)
                          }
                        />
                        <Tooltip />
                        <Bar dataKey="value">
                          {amountByStatus.map((entry, index) => (
                            <Cell
                              key={entry.status}
                              fill={
                                ["#22c55e", "#60a5fa", "#9ca3af"][index % 3]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="pft-chart-legend">
                      {amountByStatus.map((s) => (
                        <span key={s.status} className="pft-chart-legend-item">
                          {s.label}:{" "}
                          <strong>
                            {s.value.toLocaleString()} {currencyLabel}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* HIGHLIGHTS + DEADLINES (w jednej karcie) */}
          <div className="card pft-side-card">
            <div className="pft-section-header">
              <h3>{PL.highlights}</h3>
            </div>

            {!hasFundings ? (
              <div className="pft-empty">
                Podepnij co najmniej jedno finansowanie, aby zobaczyć
                podsumowanie.
              </div>
            ) : (
              <div className="pft-highlights-grid">
                {/* LEFT: highlights */}
                <div className="pft-highlights">
                  <div className="pft-highlights-row">
                    <div className="pft-highlights-label">
                      {PL.largestFunding}
                    </div>
                    <div className="pft-highlights-value">
                      {largestFundingName ?? "—"}
                      {largestFundingAmount != null && (
                        <span className="pft-highlights-sub">
                          {largestFundingAmount.toLocaleString()}{" "}
                          {largestFundingCurrency ?? currencyLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pft-highlights-row">
                    <div className="pft-highlights-label">
                      {PL.shareOfTotalBudget}
                    </div>
                    <div className="pft-highlights-bar">
                      <div className="pft-progress-track">
                        <div
                          className="pft-progress-fill"
                          style={{
                            width: `${clamp(
                              largestFundingSharePct ?? 0,
                              0,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="pft-highlights-bar-label">
                        {largestFundingSharePct != null
                          ? `${largestFundingSharePct}%`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="pft-highlights-row">
                    <div className="pft-highlights-label">
                      {PL.fundingsAtRisk}
                    </div>
                    <div className="pft-highlights-bar">
                      <div className="pft-progress-track">
                        <div
                          className="pft-progress-fill pft-progress-fill-risk"
                          style={{ width: `${clamp(atRiskPct, 0, 100)}%` }}
                        />
                      </div>
                      <span className="pft-highlights-bar-label">
                        {atRiskCount}/{totalCount || 0}
                      </span>
                    </div>
                  </div>

                  <div className="pft-highlights-row">
                    <div className="pft-highlights-label">
                      {PL.activeBudget}
                    </div>
                    <div className="pft-highlights-bar">
                      <div className="pft-progress-track">
                        <div
                          className="pft-progress-fill pft-progress-fill-active"
                          style={{
                            width: `${
                              activeBudgetPct != null
                                ? clamp(activeBudgetPct, 0, 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="pft-highlights-bar-label">
                        {activeBudgetPct != null ? `${activeBudgetPct}%` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: reporting + ending soon */}
                <div className="pft-deadlines-mini">
                  <div className="pft-deadline-section">
                    <div className="pft-deadline-title-row">
                      <span className="pft-deadline-section-title">
                        {PL.upcomingReports}
                      </span>
                    </div>
                    {upcomingDeadlines.length === 0 ? (
                      <div className="pft-empty mini">
                        {PL.noUpcomingReportingDeadlines}
                      </div>
                    ) : (
                      <ul className="pft-deadline-list">
                        {upcomingDeadlines.map((d) => (
                          <li key={d.fundingId} className="pft-deadline-item">
                            <div className="pft-deadline-title">{d.name}</div>
                            <div className="pft-deadline-meta">
                              {PL.reportingLabel}:{" "}
                              {fmtDate(d.reportingDeadline ?? undefined)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pft-deadline-section">
                    <div className="pft-deadline-title-row">
                      <span className="pft-deadline-section-title">
                        {PL.endingSoon}
                      </span>
                    </div>
                    {endingSoonItems.length === 0 ? (
                      <div className="pft-empty mini">{PL.noEndingSoon}</div>
                    ) : (
                      <ul className="pft-deadline-list">
                        {endingSoonItems.map((d) => (
                          <li key={d.fundingId} className="pft-deadline-item">
                            <div className="pft-deadline-title">{d.name}</div>
                            <div className="pft-deadline-meta">
                              {PL.ends}: {fmtDate(d.endDate)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────
 *  AKORDEON DLA POJEDYNCZEGO FUNDING
 * ───────────────────────────── */

function FundingAccordionRow({
  funding,
  projectId,
  projectFundingId,
  status,
  isAtRisk,
  today,
  onUnlink,
  unlinkDisabled,
}: {
  funding: Funding;
  projectId: number;
  projectFundingId: number | null;
  status: FundingStatus;
  isAtRisk: boolean;
  today: Date;
  onUnlink: () => void;
  unlinkDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const tasksArg = useMemo(
    () =>
      open && projectFundingId
        ? ({
            project_funding: projectFundingId,
            funding_scoped: "1",
            ordering: "-created_at" as const,
          } as TasksListParams)
        : undefined,
    [open, projectFundingId]
  );

  const {
    data: tasksPage,
    isLoading,
    isFetching,
  } = useListTasksQuery(tasksArg);

  const allTasks: Task[] = tasksPage?.results ?? [];

  const tasks: Task[] =
    projectFundingId == null
      ? allTasks
      : allTasks.filter((t) => t.scope_project_funding === projectFundingId);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  const statusLabel =
    status === "active"
      ? PL.active
      : status === "upcoming"
      ? PL.upcoming
      : status === "finished"
      ? PL.finished
      : PL.noDates;

  const statusClass =
    status === "active"
      ? "pft-status-chip-active"
      : status === "upcoming"
      ? "pft-status-chip-upcoming"
      : status === "finished"
      ? "pft-status-chip-finished"
      : "pft-status-chip-nodates";

  const endDate = parseDate(funding.end_date);
  const reportDate = parseDate(funding.reporting_deadline);

  const endDiff = endDate != null ? daysBetween(today, endDate) : null;
  const reportDiff = reportDate != null ? daysBetween(today, reportDate) : null;

  let timelineLabel = "";
  if (endDiff != null) timelineLabel = timelineLabelPL(endDiff);

  let reportLabel = "";
  if (reportDiff != null) reportLabel = reportLabelPL(reportDiff);

  const healthLabel =
    total === 0
      ? PL.noTasks
      : allDone
      ? PL.healthy
      : isAtRisk
      ? PL.atRisk
      : PL.watch;

  const healthClass =
    total === 0
      ? "pft-health-chip-muted"
      : isAtRisk
      ? "pft-health-chip-bad"
      : allDone
      ? "pft-health-chip-good"
      : "pft-health-chip-warn";

  return (
    <li className="pft-funding-row">
      <button
        type="button"
        className="pft-funding-top"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="pft-funding-main">
          <div className="pft-funding-title-row">
            <span className="pft-funding-name">{funding.name}</span>
            {funding.type && (
              <span className="pft-tag">
                {funding.type.charAt(0).toUpperCase() + funding.type.slice(1)}
              </span>
            )}
            <span className={`pft-status-chip ${statusClass}`}>
              {statusLabel}
            </span>
            <span className={`pft-health-chip ${healthClass}`}>
              {healthLabel}
            </span>
          </div>

          <div className="pft-funding-meta">
            <span>
              {funding.program || "—"} • {funding.funder || "—"}
            </span>
            {funding.amount_total != null && (
              <span className="pft-funding-amount">
                • {Number(funding.amount_total).toLocaleString()}{" "}
                {funding.currency ?? "PLN"}
              </span>
            )}
          </div>

          <div className="pft-funding-dates">
            <span>
              {funding.start_date ? fmtDate(funding.start_date) : "—"} →{" "}
              {funding.end_date ? fmtDate(funding.end_date) : "—"}
            </span>
            {timelineLabel && (
              <span className="pft-funding-timeline">• {timelineLabel}</span>
            )}
            {reportLabel && (
              <span className="pft-funding-report">• {reportLabel}</span>
            )}
          </div>
        </div>

        <div className="pft-funding-right">
          <div className="pft-mini-progress">
            <div className="pft-mini-progress-track">
              <div
                className="pft-mini-progress-fill"
                style={{ width: `${clamp(donePct, 0, 100)}%` }}
              />
            </div>
            <span className="pft-mini-progress-label">
              {total === 0
                ? PL.noTasksYet
                : allDone
                ? PL.allTasksDone
                : PL.doneOf(done, total)}
            </span>
          </div>

          <button
            type="button"
            className="btn-ghost pft-open-indicator"
            aria-label="Toggle tasks"
          >
            {open ? PL.hide : PL.show}
          </button>
        </div>
      </button>

      {open && (
        <div className="pft-funding-body">
          <div className="pft-funding-body-head">
            <div className="pft-funding-body-left">
              <span className="pft-funding-body-title">
                {PL.tasksInThisProject}
              </span>
              <span className="pft-funding-body-meta">
                {isFetching
                  ? PL.tasksCountRefreshing(total)
                  : PL.tasksCount(total)}
              </span>
            </div>
            <div className="pft-funding-body-actions">
              <a
                className="btn"
                href={`/dashboard/tasks?project=${projectId}&funding=${funding.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                {PL.openInTasks}
              </a>
              <button
                type="button"
                className="btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink();
                }}
                disabled={unlinkDisabled}
              >
                {unlinkDisabled ? PL.unlinking : PL.unlink}
              </button>
            </div>
          </div>

          <div className="pft-funding-tasks">
            {isLoading && total === 0 ? (
              <div className="pft-empty mini">{PL.loadingTasks}</div>
            ) : total === 0 ? (
              <div className="pft-empty mini">{PL.noTasksYetHint}</div>
            ) : (
              <ul className="pft-funding-task-list">
                {tasks.map((t) => (
                  <li key={t.id} className="pft-funding-task-row">
                    <div className="pft-task-main">
                      <div className="pft-task-title">{t.title}</div>
                      {t.description && (
                        <div className="pft-task-desc">{t.description}</div>
                      )}
                      <div className="pft-task-meta">
                        <span className={`chip ${statusChipClass(t.status)}`}>
                          {String(t.status).toUpperCase()}
                        </span>
                        {t.priority != null && (
                          <span className="chip chip--sky">P{t.priority}</span>
                        )}
                        {t.due_date && (
                          <span className="pft-task-date">
                            • {PL.due}: {t.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function statusChipClass(status: Task["status"] | undefined): string {
  const s = status ?? "todo";
  if (s === "done") return "chip--green";
  if (s === "doing") return "chip--amber";
  return "chip--gray";
}
