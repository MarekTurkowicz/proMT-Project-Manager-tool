import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import ProjectFundingsTab from "../../../src/features/projects/tabs/ProjectFundingsTab.tsx";
import type { Project } from "../../../src/features/types/project";
import type { Funding } from "../../../src/features/types/funding";

const mockUseProject = vi.fn();
const mockUseListFundingsQuery = vi.fn();
const mockUsePickFundingsQuery = vi.fn();
const mockUseCreateFundingMutation = vi.fn();
const mockUseListProjectFundingsQuery = vi.fn();
const mockUseCreateProjectFundingMutation = vi.fn();
const mockUseDeleteProjectFundingMutation = vi.fn();
const mockUseListTasksQuery = vi.fn();

declare global {
  var ResizeObserver: any;
}

vi.mock("../../../src/features/projects/context/ProjectContext.tsx", () => ({
  useProject: () => mockUseProject(),
}));

vi.mock("../../../src/features/api/fundingApi.ts", () => ({
  useListFundingsQuery: (p: any) => mockUseListFundingsQuery(p),
  usePickFundingsQuery: () => mockUsePickFundingsQuery(),
  useCreateFundingMutation: () => mockUseCreateFundingMutation(),
}));

vi.mock("../../../src/features/api/projectFundingApi.ts", () => ({
  useListProjectFundingsQuery: (p: any) => mockUseListProjectFundingsQuery(p),
  useCreateProjectFundingMutation: () => mockUseCreateProjectFundingMutation(),
  useDeleteProjectFundingMutation: () => mockUseDeleteProjectFundingMutation(),
}));

vi.mock("../../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
}));

const project: Project = {
  id: 3,
  name: "Proj Fund",
  description: "",
  status: "active",
  start_date: null,
  end_date: null,
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

const funding: Funding = {
  id: 10,
  name: "NCBR",
  program: "Prog",
  funder: "NCBR",
  amount_total: "100000",
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  type: "grant",
  currency: "PLN",
  agreement_number: null,
  reporting_deadline: null,
  description: null,
  created_at: "2025-01-01T00:00:00Z",
};

beforeEach(() => {
  mockUseProject.mockReturnValue(project);

  mockUseListFundingsQuery.mockReturnValue({
    data: { count: 1, results: [funding] },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  });

  mockUsePickFundingsQuery.mockReturnValue({ data: [funding], refetch: vi.fn() });

  mockUseCreateFundingMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue(funding) })),
  ]);

  mockUseListProjectFundingsQuery.mockReturnValue({
    data: { results: [{ id: 1, project: project.id, funding: funding.id }] },
    refetch: vi.fn(),
  });

  mockUseCreateProjectFundingMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({}) })),
    { isLoading: false },
  ]);
  mockUseDeleteProjectFundingMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({}) })),
    { isLoading: false },
  ]);

  mockUseListTasksQuery.mockReturnValue({
    data: { count: 0, results: [] },
  });

  if (!("ResizeObserver" in globalThis)) {
    // @ts-expect-error
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("ProjectFundingsTab", () => {
  it("renders KPI strip and linked funding list", () => {
    render(<ProjectFundingsTab />);

    expect(screen.getByText(/Źródła finansowania/i)).toBeInTheDocument();
    expect(screen.getAllByText("NCBR").length).toBeGreaterThan(0);
    expect(screen.getByText(/Podpięte finansowania/i)).toBeInTheDocument();
  });
});
