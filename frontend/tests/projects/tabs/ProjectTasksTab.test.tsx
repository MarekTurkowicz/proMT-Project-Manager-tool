import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import ProjectTasksTab from "../../../src/features/projects/tabs/ProjectTasksTab.tsx";
import type { Project } from "../../../src/features/types/project";
import type { Task } from "../../../src/features/tasks/types";

const mockUseProject = vi.fn();
const mockUseListTasksQuery = vi.fn();
const mockUseCreateTaskMutation = vi.fn();

declare global {
  var ResizeObserver: any;
}

vi.mock("../../../src/features/projects/context/ProjectContext.tsx", () => ({
  useProject: () => mockUseProject(),
}));

vi.mock("../../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
  useCreateTaskMutation: () => mockUseCreateTaskMutation(),
  usePickProjectsQuery: () => ({ data: [], isLoading: false }),
  usePickFundingsQuery: () => ({ data: [], isLoading: false }),
}));

const project: Project = {
  id: 1,
  name: "Proj",
  description: "",
  status: "active",
  start_date: null,
  end_date: null,
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

const tasks: Task[] = [
  {
    id: 1,
    title: "Task A",
    description: "",
    status: "todo",
    priority: 2,
    start_date: null,
    due_date: null,
    cost_amount: null,
    cost_currency: "PLN",
    receipt_url: "",
    receipt_note: "",
    est_hours: null,
    template: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
    scope_project: 1,
    scope_funding: null,
    scope_project_funding: null,
    project_name: "Proj",
    funding_name: null,
    assignees: [],
  },
];

beforeEach(() => {
  mockUseProject.mockReturnValue(project);
  mockUseListTasksQuery.mockReturnValue({
    data: { count: tasks.length, results: tasks },
    isLoading: false,
  });
  mockUseCreateTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({}) })),
  ]);

  if (!("ResizeObserver" in globalThis)) {
    // @ts-expect-error
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("ProjectTasksTab", () => {
  it("renders KPI strip and list of tasks", () => {
    render(<ProjectTasksTab />);

    expect(screen.getByText(/Wszystkie zadania/i)).toBeInTheDocument();
    expect(screen.getByText("Task A")).toBeInTheDocument();
  });
});
