import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import ProjectKanbanTab from "../../../src/features/projects/tabs/ProjectKanbanTab.tsx";
import type { Project } from "../../../src/features/types/project";
import type { Task } from "../../../src/features/tasks/types";

const mockUseProject = vi.fn();
const mockUseListTasksQuery = vi.fn();
const mockUseUpdateTaskMutation = vi.fn();
const mockUseCreateTaskMutation = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Droppable: ({ children }: any) =>
    children(
      {
        innerRef: () => {},
        droppableProps: {},
      },
      { isDraggingOver: false },
    ),
  Draggable: ({ children }: any) =>
    children(
      {
        innerRef: () => {},
        draggableProps: {},
        dragHandleProps: {},
      },
      { isDragging: false },
    ),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
}));

vi.mock("../../../src/features/projects/context/ProjectContext.tsx", () => ({
  useProject: () => mockUseProject(),
}));
vi.mock("../../../src/features/tasks/tasksApi.ts", () => {
  const updateQueryData = vi.fn();
  return {
    useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
    useUpdateTaskMutation: () => mockUseUpdateTaskMutation(),
    useCreateTaskMutation: () => mockUseCreateTaskMutation(),
    tasksApi: { util: { updateQueryData } },
    usePickProjectsQuery: () => ({ data: [], isLoading: false }),
    usePickFundingsQuery: () => ({ data: [], isLoading: false }),
  };
});

const project: Project = {
  id: 2,
  name: "Proj Kanban",
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
    title: "Todo task",
    description: "",
    status: "todo",
    priority: 1,
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
    scope_project: 2,
    scope_funding: null,
    scope_project_funding: null,
    project_name: "Proj Kanban",
    funding_name: null,
    assignees: [],
  },
];

beforeEach(() => {
  mockUseProject.mockReturnValue(project);
  mockUseListTasksQuery.mockReturnValue({
    data: { count: tasks.length, results: tasks },
    isLoading: false,
    isFetching: false,
  });
  mockUseUpdateTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({}) })),
  ]);
  mockUseCreateTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue({}) })),
  ]);
});

describe("ProjectKanbanTab", () => {
  it("renders three kanban columns with header labels", () => {
    render(<ProjectKanbanTab />);

    expect(screen.getAllByText(/Do zrobienia/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/W trakcie/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Zrobione/i).length).toBeGreaterThan(0);

    expect(screen.getByText("Todo task")).toBeInTheDocument();
  });
});
