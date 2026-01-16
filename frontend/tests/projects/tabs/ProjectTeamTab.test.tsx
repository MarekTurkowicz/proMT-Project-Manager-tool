import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import ProjectTeamTab from "../../../src/features/projects/tabs/ProjectTeamTab.tsx";
import type { Project } from "../../../src/features/types/project";
import type { AppUser } from "../../../src/features/types/users";
import type { Task } from "../../../src/features/tasks/types";

const mockUseProject = vi.fn();
const mockUseListUsersQuery = vi.fn();
const mockUseListTasksQuery = vi.fn();
const mockUseUpdateTaskMutation = vi.fn();
const mockDispatch = vi.fn();

declare global {
  var ResizeObserver: any;
}

vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
}));

vi.mock("../../../src/features/projects/context/ProjectContext.tsx", () => ({
  useProject: () => mockUseProject(),
}));

vi.mock("../../../src/features/api/usersApi.ts", () => ({
  useListUsersQuery: () => mockUseListUsersQuery(),
}));

vi.mock("../../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
  useUpdateTaskMutation: () => mockUseUpdateTaskMutation(),
  tasksApi: { util: { updateQueryData: vi.fn(() => ({ undo: vi.fn() })) } },
}));

const project: Project = {
  id: 6,
  name: "Proj Team",
  description: "",
  status: "active",
  start_date: null,
  end_date: null,
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

const users: AppUser[] = [
  {
    id: 1,
    username: "alice",
    email: "alice@example.com",
    is_staff: false,
  },
];

const tasks: Task[] = [
  {
    id: 1,
    title: "Task team",
    description: "",
    status: "doing",
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
    scope_project: 6,
    scope_funding: null,
    scope_project_funding: null,
    project_name: "Proj Team",
    funding_name: null,
    assignees: [users[0]],
  },
];

beforeEach(() => {
  mockUseProject.mockReturnValue(project);
  mockUseListUsersQuery.mockReturnValue({ data: users, isLoading: false });
  mockUseListTasksQuery.mockReturnValue({
    data: { count: tasks.length, results: tasks },
    isFetching: false,
  });
  mockUseUpdateTaskMutation.mockReturnValue([
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

describe("ProjectTeamTab", () => {
  it("renders team snapshot and people sidebar heading", () => {
    render(<ProjectTeamTab />);

    expect(screen.getByText(/Team snapshot/i)).toBeInTheDocument();
    expect(screen.getAllByText(/People/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
  });
});
