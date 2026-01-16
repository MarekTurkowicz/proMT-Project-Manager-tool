import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import ProjectTimelineTab from "../../../src/features/projects/tabs/ProjectTimelineTab.tsx";
import type { Project } from "../../../src/features/types/project";
import type { Task } from "../../../src/features/tasks/types";

const mockUseProject = vi.fn();
const mockUseListTasksQuery = vi.fn();
const mockUseUpdateTaskMutation = vi.fn();
const mockUseCreateTaskMutation = vi.fn();
const mockDispatch = vi.fn();

vi.mock("../../../src/features/projects/context/ProjectContext.tsx", () => ({
  useProject: () => mockUseProject(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
}));

vi.mock("vis-timeline/standalone", () => ({
  Timeline: class {
    constructor() {}
    on() {}
    setWindow() {}
    redraw() {}
    fit() {}
    getWindow() {
      const now = new Date();
      return { start: now, end: new Date(now.getTime() + 86400000) };
    }
  },
}));

vi.mock("vis-data", () => ({
  DataSet: class {
    clear() {}
    add() {}
  },
}));

vi.mock("../../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
  useUpdateTaskMutation: () => mockUseUpdateTaskMutation(),
  useCreateTaskMutation: () => mockUseCreateTaskMutation(),
  tasksApi: { util: { updateQueryData: vi.fn(() => ({ undo: vi.fn() })) } },
}));

const project: Project = {
  id: 4,
  name: "Proj Timeline",
  description: "",
  status: "active",
  start_date: null,
  end_date: null,
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

const tasks: Task[] = [];

beforeEach(() => {
  mockUseProject.mockReturnValue(project);
  mockUseListTasksQuery.mockReturnValue({
    data: { count: tasks.length, results: tasks },
    isFetching: false,
  });
  mockUseUpdateTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({}) })),
  ]);
  mockUseCreateTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({ id: 99 }) })),
  ]);
});

describe("ProjectTimelineTab", () => {
  it("renders toolbar and main timeline container", () => {
    render(<ProjectTimelineTab />);

    expect(screen.getByText(/Powiększ/i)).toBeInTheDocument();
    expect(screen.getByText(/Dziś/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Szukaj zadań…/i)).toBeInTheDocument();
  });
});
