import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import ProjectOverviewTab from "../../src/features/projects/tabs/ProjectOverviewTab";
import type { Project } from "../../src/features/types/project";

const mockUseProject = vi.fn();
const mockUseListTasksQuery = vi.fn();

vi.mock("../../src/features/projects/context/ProjectContext.tsx", () => ({
  useProject: () => mockUseProject(),
}));

vi.mock("../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
}));

const project: Project = {
  id: 5,
  name: "Overview project",
  description: "Opis",
  status: "active",
  start_date: "2025-01-01",
  end_date: "2025-06-30",
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

declare global {
  var ResizeObserver: any;
}

beforeEach(() => {
  vi.clearAllMocks();

  if (!("ResizeObserver" in globalThis)) {
    // @ts-expect-error - test env shim
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  mockUseProject.mockReturnValue(project);
  mockUseListTasksQuery.mockReturnValue({
    data: { count: 0, next: null, previous: null, results: [] },
    isLoading: false,
  });
});

describe("ProjectOverviewTab", () => {
  it("fetches tasks for given project and renders basic overview", () => {
    render(<ProjectOverviewTab />);

    expect(mockUseListTasksQuery).toHaveBeenCalledWith({
      project: project.id,
      ordering: "-created_at",
    });

    expect(
      screen.getByRole("heading", { name: /Overview project/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/Brak zadań\./i)).toBeInTheDocument();
  });
});
