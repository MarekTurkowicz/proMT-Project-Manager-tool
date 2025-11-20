import { useMemo, useState } from "react";
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

import type { Funding, FundingType, FundingCreate } from "../../types/funding";
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

/* ─────────────────────────────
 *  Typy pomocnicze
 * ───────────────────────────── */

type AmountByTypeItem = {
  type: FundingType | "other";
  label: string;
  value: number;
};

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

type ChartMode = "type" | "top" | "status";
type LeftTab = "list" | "budget";

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
  amountByType: AmountByTypeItem[];
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
  fundingsWithoutDates: number;
  reportsOverdue: number;
  endingSoonCount: number;
  endingSoonItems: EndingSoonItem[];
  nextReportingDays: number | null;
};

type CoverageStatus =
  | "nodata"
  | "nocosts"
  | "nofunding"
  | "covered"
  | "underfunded";

/* ─────────────────────────────
 *  Utils
 * ───────────────────────────── */

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

function humanizeDaysDiff(diff: number | null): string {
  if (diff == null) return "No upcoming reports";
  if (diff === 0) return "Next report: today";
  if (diff === 1) return "Next report: in 1 day";
  if (diff > 1) return `Next report: in ${diff} days`;
  return "No upcoming reports";
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

/* ─────────────────────────────
 *  GŁÓWNY KOMPONENT
 * ───────────────────────────── */

export default function ProjectFundingsTab() {
  const project = useProject();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [leftTab, setLeftTab] = useState<LeftTab>("list");
  const [chartMode, setChartMode] = useState<ChartMode>("type");
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

    const ok = window.confirm(
      "Unlink this funding from project? Grant-scoped copied tasks will be removed."
    );
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
    amountByType,
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

    const byTypeMap = new Map<string, number>();

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

        const typeKey = f.type ?? "other";
        byTypeMap.set(typeKey, (byTypeMap.get(typeKey) ?? 0) + amountNum);
      }

      if (f.start_date && f.end_date) {
        withDates += 1;
      }
      if (f.reporting_deadline) {
        withReporting += 1;
      }
    });

    const sumAmount: number | null =
      numericAmounts.length > 0
        ? numericAmounts.reduce((acc, v) => acc + v, 0)
        : null;

    const amountByTypeArr: AmountByTypeItem[] = Array.from(
      byTypeMap.entries()
    ).map(
      ([type, value]): AmountByTypeItem => ({
        type: type as FundingType | "other",
        label: type.charAt(0).toUpperCase() + type.slice(1),
        value: Number(value),
      })
    );

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
      {
        status: "active",
        label: "Active",
        value: activeAmount,
      },
      {
        status: "upcoming",
        label: "Upcoming",
        value: upcomingAmount,
      },
      {
        status: "finished",
        label: "Finished",
        value: finishedAmount,
      },
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
      amountByType: amountByTypeArr,
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

      const perFunding: PerFundingCompletion[] = linkedFundings.map(
        (f): PerFundingCompletion => {
          const s = stats.get(f.id) ?? { total: 0, done: 0 };
          const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
          return {
            fundingId: f.id,
            name: f.name,
            total: s.total,
            done: s.done,
            pct,
          };
        }
      );

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

      if (totalTaskCost === 0 && (!totalAmount || totalAmount === 0)) {
        status = "nodata";
      } else if (totalTaskCost === 0) {
        status = "nocosts";
      } else if (!totalAmount || totalAmount === 0) {
        status = "nofunding";
      } else if (totalAmount >= totalTaskCost) {
        status = "covered";
      } else {
        status = "underfunded";
      }

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
              { name: "Fundings", value: fundingVal },
              { name: "Task costs", value: costsVal },
            ];

      return {
        taskCostTotal: totalTaskCost,
        coverageStatus: status,
        coveragePct: pct,
        coveragePieData: pieData,
      };
    }, [projectTasks, totalAmount]);

  // ── RISK & DUE ANALYTICS ─────────────────────

  const { atRiskCount, atRiskIds, endingSoonItems, nextReportingDays } =
    useMemo<RiskStats>(() => {
      const completionMap = new Map<number, PerFundingCompletion>();
      perFundingCompletion.forEach((p) => completionMap.set(p.fundingId, p));

      let atRisk = 0;
      const atRiskIdsAcc: number[] = [];
      let withoutDates = 0;
      let overdueReports = 0;

      const endingSoonAcc: EndingSoonItem[] = [];
      const upcomingReportDiffs: number[] = [];

      linkedFundings.forEach((f) => {
        const start = parseDate(f.start_date);
        const end = parseDate(f.end_date);
        const report = parseDate(f.reporting_deadline);
        const completionPct = completionMap.get(f.id)?.pct ?? 0;

        if (!start || !end) withoutDates += 1;

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
          if (diff < 0) {
            overdueReports += 1;
          } else {
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

      const endingSoonCnt = endingSoonAcc.length;
      const nextReport =
        upcomingReportDiffs.length > 0
          ? Math.min(...upcomingReportDiffs)
          : null;

      return {
        atRiskCount: atRisk,
        atRiskIds: atRiskIdsAcc,
        fundingsWithoutDates: withoutDates,
        reportsOverdue: overdueReports,
        endingSoonCount: endingSoonCnt,
        endingSoonItems: endingSoonAcc.sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        ),
        nextReportingDays: nextReport,
      };
    }, [linkedFundings, perFundingCompletion, today]);

  const nextReportingLabel = humanizeDaysDiff(nextReportingDays);

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
      {/* MODAL NOWEGO FUNDING */}
      <AddFundingModal
        open={openAddFunding}
        onClose={() => setOpenAddFunding(false)}
        onSubmit={handleCreateFunding}
      />

      {/* KPI STRIP */}
      <div className="card pft-kpi-strip">
        {/* 1. Fundings */}
        <div className="pft-kpi-item">
          <div className="pft-kpi-label">Fundings</div>
          <div className="pft-kpi-value">{totalCount}</div>
          <div className="pft-kpi-meta">
            {totalCount === 0
              ? "No fundings linked yet"
              : `${activeCount} active • ${upcomingCount} upcoming • ${finishedCount} finished`}
          </div>
        </div>

        {/* 2. Total budget */}
        <div className="pft-kpi-item">
          <div className="pft-kpi-label">Total budget</div>
          <div className="pft-kpi-value">
            {totalAmount != null
              ? `${totalAmount.toLocaleString()} ${currencyLabel}`
              : "—"}
          </div>
          <div className="pft-kpi-meta">
            Sum of all linked fundings with amount set
          </div>
        </div>

        {/* 3. Data completeness */}
        <div className="pft-kpi-item">
          <div className="pft-kpi-label">Data completeness</div>
          <div className="pft-kpi-value">
            {totalCount === 0 ? "—" : `${completenessPct}%`}
          </div>
          <div className="pft-kpi-meta-lines">
            <span>
              Amount:{" "}
              <strong>
                {withAmountCount}/{totalCount || 0}
              </strong>
            </span>
            <span>
              Dates:{" "}
              <strong>
                {withDatesCount}/{totalCount || 0}
              </strong>
            </span>
            <span>
              Reporting:{" "}
              <strong>
                {withReportingCount}/{totalCount || 0}
              </strong>
            </span>
          </div>
        </div>

        {/* 4. Funding health */}
        <div className="pft-kpi-item">
          <div className="pft-kpi-label">Funding health</div>
          <div className="pft-kpi-value">
            {atRiskCount > 0
              ? `${atRiskCount} at risk`
              : totalFundingTasks === 0
              ? "No tasks"
              : "Healthy"}
          </div>
          <div className="pft-kpi-meta">
            {totalFundingTasks === 0
              ? "No funding-scoped tasks yet"
              : `${fundingCompletionPct}% of funding tasks done`}
            <br />
            {nextReportingLabel}
          </div>
        </div>

        {/* 5. Link / New funding */}
        <div className="pft-kpi-item pft-kpi-link">
          <div className="pft-kpi-label">Link funding</div>
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
                  ? "Select funding…"
                  : "All fundings already linked"}
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
              {isLinking ? "Linking…" : "Link"}
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary pft-kpi-new-btn"
            onClick={() => setOpenAddFunding(true)}
          >
            New funding
          </button>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="pft-layout">
        {/* LEWA KOLUMNA */}
        <div className="pft-main">
          <div className="card pft-list-card">
            <div className="pft-list-tabs">
              <button
                type="button"
                className={
                  "pft-list-tab" + (leftTab === "list" ? " is-active" : "")
                }
                onClick={() => setLeftTab("list")}
              >
                Linked fundings
              </button>
              <button
                type="button"
                className={
                  "pft-list-tab" + (leftTab === "budget" ? " is-active" : "")
                }
                onClick={() => setLeftTab("budget")}
              >
                Budget insights
              </button>
              {isFundingsFetching && (
                <span className="pft-badge pft-badge-muted">Refreshing…</span>
              )}
            </div>

            {leftTab === "list" ? (
              <>
                {/* Filtry statusów */}
                <div className="pft-status-filters">
                  {(
                    [
                      ["all", "All"],
                      ["active", "Active"],
                      ["upcoming", "Upcoming"],
                      ["finished", "Finished"],
                      ["risk", "At risk"],
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
                  <div className="pft-empty">Loading fundings…</div>
                ) : !hasFundings ? (
                  <div className="pft-empty">
                    <div className="pft-empty-title">No fundings linked</div>
                    <div className="pft-empty-text">
                      Link at least one funding program or create a new one to
                      see project budget overview.
                    </div>
                  </div>
                ) : displayFundings.length === 0 ? (
                  <div className="pft-empty">
                    No fundings matching current filter.
                  </div>
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
                            projectFundingId={
                              pfByFundingId.get(f.id)?.id ?? null
                            }
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
              </>
            ) : (
              <BudgetInsightsTab
                hasFundings={hasFundings}
                chartMode={chartMode}
                setChartMode={setChartMode}
                amountByType={amountByType}
                amountBars={amountBars}
                amountByStatus={amountByStatus}
                currencyLabel={currencyLabel}
              />
            )}
          </div>
        </div>

        {/* PRAWA KOLUMNA */}
        <div className="pft-side">
          {/* BUDGET COVERAGE */}
          <div className="card pft-side-card">
            <div className="pft-section-header">
              <h3>Budget coverage</h3>
            </div>

            {coveragePieData.length === 0 ? (
              <div className="pft-empty">No funding and no task costs yet.</div>
            ) : (
              <>
                <div className="pft-completion-top">
                  <div className="pft-completion-chart">
                    <ResponsiveContainer width="100%" height={110}>
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
                      <div className="pft-completion-label">costs covered</div>
                    </div>
                  </div>
                  <div className="pft-completion-meta">
                    <div className="pft-completion-line">
                      <span>Fundings</span>
                      <span>
                        {totalAmount != null
                          ? `${totalAmount.toLocaleString()} ${currencyLabel}`
                          : `0 ${currencyLabel}`}
                      </span>
                    </div>
                    <div className="pft-completion-line">
                      <span>Task costs</span>
                      <span>
                        {taskCostTotal.toLocaleString()} {currencyLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pft-completion-list">
                  <div className="pft-completion-row">
                    <div className="pft-completion-row-head">
                      <span className="pft-completion-name">
                        Coverage status
                      </span>
                    </div>
                    <div className="pft-empty mini">
                      {coverageStatus === "nodata" &&
                        "No funding and no task costs yet."}
                      {coverageStatus === "nocosts" &&
                        "Funding exists, but no tasks with cost yet."}
                      {coverageStatus === "nofunding" &&
                        "Tasks have costs but there is no funding linked."}
                      {coverageStatus === "covered" &&
                        "Current funding covers existing task costs."}
                      {coverageStatus === "underfunded" &&
                        "Task costs are higher than total funding – project is over budget."}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* HIGHLIGHTS */}
          <div className="card pft-side-card">
            <div className="pft-section-header">
              <h3>Highlights</h3>
            </div>
            {!hasFundings ? (
              <div className="pft-empty">
                Link at least one funding to see highlights.
              </div>
            ) : (
              <div className="pft-highlights">
                <div className="pft-highlights-row">
                  <div className="pft-highlights-label">Largest funding</div>
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
                    Share of total budget
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
                  <div className="pft-highlights-label">Fundings at risk</div>
                  <div className="pft-highlights-bar">
                    <div className="pft-progress-track">
                      <div
                        className="pft-progress-fill pft-progress-fill-risk"
                        style={{
                          width: `${clamp(atRiskPct, 0, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="pft-highlights-bar-label">
                      {atRiskCount}/{totalCount || 0}
                    </span>
                  </div>
                </div>

                <div className="pft-highlights-row">
                  <div className="pft-highlights-label">Active budget</div>
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
            )}
          </div>

          {/* DEADLINES */}
          <div className="card pft-side-card">
            <div className="pft-section-header">
              <h3>Reporting & ending soon</h3>
            </div>

            {!hasFundings ? (
              <div className="pft-empty">
                No fundings linked – no deadlines to show.
              </div>
            ) : (
              <>
                <div className="pft-deadline-section">
                  <div className="pft-deadline-title-row">
                    <span className="pft-deadline-section-title">
                      Upcoming reports
                    </span>
                  </div>
                  {upcomingDeadlines.length === 0 ? (
                    <div className="pft-empty mini">
                      No upcoming reporting deadlines.
                    </div>
                  ) : (
                    <ul className="pft-deadline-list">
                      {upcomingDeadlines.map((d) => (
                        <li key={d.fundingId} className="pft-deadline-item">
                          <div className="pft-deadline-title">{d.name}</div>
                          <div className="pft-deadline-meta">
                            Reporting:{" "}
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
                      Ending soon (&lt; 30 days)
                    </span>
                  </div>
                  {endingSoonItems.length === 0 ? (
                    <div className="pft-empty mini">
                      No fundings ending in the next 30 days.
                    </div>
                  ) : (
                    <ul className="pft-deadline-list">
                      {endingSoonItems.map((d) => (
                        <li key={d.fundingId} className="pft-deadline-item">
                          <div className="pft-deadline-title">{d.name}</div>
                          <div className="pft-deadline-meta">
                            Ends: {fmtDate(d.endDate)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────
 *  LEWY TAB: BUDGET INSIGHTS
 * ───────────────────────────── */

function BudgetInsightsTab({
  hasFundings,
  chartMode,
  setChartMode,
  amountByType,
  amountBars,
  amountByStatus,
  currencyLabel,
}: {
  hasFundings: boolean;
  chartMode: ChartMode;
  setChartMode: (m: ChartMode) => void;
  amountByType: AmountByTypeItem[];
  amountBars: FundingBarItem[];
  amountByStatus: AmountByStatusItem[];
  currencyLabel: string;
}) {
  return (
    <div className="pft-budget-root">
      {!hasFundings ? (
        <div className="pft-empty">No data yet.</div>
      ) : (
        <>
          <div className="pft-chart-tabs">
            <button
              type="button"
              className={
                "pft-chart-tab" + (chartMode === "type" ? " is-active" : "")
              }
              onClick={() => setChartMode("type")}
            >
              By type
            </button>
            <button
              type="button"
              className={
                "pft-chart-tab" + (chartMode === "top" ? " is-active" : "")
              }
              onClick={() => setChartMode("top")}
            >
              Top by amount
            </button>
            <button
              type="button"
              className={
                "pft-chart-tab" + (chartMode === "status" ? " is-active" : "")
              }
              onClick={() => setChartMode("status")}
            >
              By status
            </button>
          </div>

          {chartMode === "type" && (
            <>
              {amountByType.length === 0 ? (
                <div className="pft-empty">No amount data to visualise.</div>
              ) : (
                <div className="pft-chart-inner">
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={amountByType}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                      >
                        {amountByType.map((entry, index) => (
                          <Cell
                            key={entry.type}
                            fill={
                              [
                                "#60a5fa",
                                "#34d399",
                                "#f97316",
                                "#e11d48",
                                "#8b5cf6",
                              ][index % 5]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pft-chart-legend">
                    {amountByType.map((t) => (
                      <span key={t.type} className="pft-chart-legend-item">
                        {t.label}:{" "}
                        <strong>
                          {t.value.toLocaleString()} {currencyLabel}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {chartMode === "top" && (
            <>
              {amountBars.length === 0 ? (
                <div className="pft-empty">No amount data to visualise.</div>
              ) : (
                <div className="pft-chart-inner">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart
                      data={amountBars}
                      layout="vertical"
                      margin={{ left: 90, right: 16, top: 8, bottom: 8 }}
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
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="value" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {chartMode === "status" && (
            <>
              {amountByStatus.length === 0 ? (
                <div className="pft-empty">No amount data to visualise.</div>
              ) : (
                <div className="pft-chart-inner">
                  <ResponsiveContainer width="100%" height={190}>
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
                            fill={["#22c55e", "#60a5fa", "#9ca3af"][index % 3]}
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
        </>
      )}
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

  // tylko taski z tego konkretnego project_funding
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
      ? "Active"
      : status === "upcoming"
      ? "Upcoming"
      : status === "finished"
      ? "Finished"
      : "No dates";

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
  if (endDiff != null) {
    if (endDiff < 0) {
      timelineLabel = `Ended ${Math.abs(endDiff)} days ago`;
    } else if (endDiff === 0) {
      timelineLabel = "Ends today";
    } else {
      timelineLabel = `Ends in ${endDiff} days`;
    }
  }

  let reportLabel = "";
  if (reportDiff != null) {
    if (reportDiff < 0) {
      reportLabel = `Report overdue by ${Math.abs(reportDiff)} days`;
    } else if (reportDiff === 0) {
      reportLabel = "Report due today";
    } else {
      reportLabel = `Report in ${reportDiff} days`;
    }
  }

  const healthLabel =
    total === 0
      ? "No tasks"
      : allDone
      ? "Healthy"
      : isAtRisk
      ? "At risk"
      : "Watch";

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
                ? "No tasks yet"
                : allDone
                ? "All tasks done"
                : `${done}/${total} done`}
            </span>
          </div>

          <button
            type="button"
            className="btn-ghost pft-open-indicator"
            aria-label="Toggle tasks"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </button>

      {open && (
        <div className="pft-funding-body">
          <div className="pft-funding-body-head">
            <div className="pft-funding-body-left">
              <span className="pft-funding-body-title">
                Tasks in this project
              </span>
              <span className="pft-funding-body-meta">
                {total} tasks
                {isFetching ? " (refreshing…)" : ""}
              </span>
            </div>
            <div className="pft-funding-body-actions">
              <a
                className="btn"
                href={`/dashboard/tasks?project=${projectId}&funding=${funding.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open in Tasks
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
                {unlinkDisabled ? "Unlinking…" : "Unlink"}
              </button>
            </div>
          </div>

          <div className="pft-funding-tasks">
            {isLoading && total === 0 ? (
              <div className="pft-empty mini">Loading tasks…</div>
            ) : total === 0 ? (
              <div className="pft-empty mini">
                No tasks yet – they will appear here after linking template
                tasks or creating project tasks for this funding.
              </div>
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
                            • Due: {t.due_date}
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
