import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import TasksPage from "../../src/features/tasks/pages/TaskPage.tsx";
import type { Task } from "../../src/features/tasks/types";
import type { CreateTaskPayload } from "../../src/features/tasks/types";

const mockUseListTasksQuery = vi.fn();
const mockUseCreateTaskMutation = vi.fn();
const mockUseDeleteTaskMutation = vi.fn();
const mockUseUpdateTaskMutation = vi.fn();

const mockUsePickProjectsQuery = vi.fn();
const mockUsePickFundingsQuery = vi.fn();

vi.mock("../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (params: unknown) => mockUseListTasksQuery(params),
  useCreateTaskMutation: () => mockUseCreateTaskMutation(),
  useDeleteTaskMutation: () => mockUseDeleteTaskMutation(),
  useUpdateTaskMutation: () => mockUseUpdateTaskMutation(),
  usePickProjectsQuery: () => mockUsePickProjectsQuery(),
  usePickFundingsQuery: () => mockUsePickFundingsQuery(),
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const existingTask: Task = {
  id: 1,
  title: "Istniejące zadanie",
  description: "Opis istniejącego zadania",
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
  scope_project: null,
  scope_funding: null,
  scope_project_funding: null,
  project_name: null,
  funding_name: null,
  assignees: [],
};

const newTaskTitle = "Nowe zadanie poprawne";

beforeEach(() => {
  vi.clearAllMocks();

  mockUsePickProjectsQuery.mockReturnValue({ data: [], isLoading: false });
  mockUsePickFundingsQuery.mockReturnValue({ data: [], isLoading: false });

  const initialData = {
    count: 1,
    next: null,
    previous: null,
    results: [existingTask],
  };

  const createdTask: Task = {
    ...existingTask,
    id: 2,
    title: newTaskTitle,
  };

  const updatedData = {
    count: 2,
    next: null,
    previous: null,
    results: [existingTask, createdTask],
  };

  const refetch = vi.fn();

  mockUseListTasksQuery
    .mockReturnValueOnce({
      data: initialData,
      isLoading: false,
      isFetching: false,
      error: undefined,
      refetch,
    })
    .mockReturnValue({
      data: updatedData,
      isLoading: false,
      isFetching: false,
      error: undefined,
      refetch,
    });

  const createTaskFn = vi.fn((payload: CreateTaskPayload) => ({
    unwrap: vi.fn().mockResolvedValue({ id: 2, ...payload }),
  }));

  mockUseCreateTaskMutation.mockReturnValue([
    createTaskFn,
    { isLoading: false },
  ]);

  mockUseDeleteTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue(undefined) })),
  ]);
  mockUseUpdateTaskMutation.mockReturnValue([
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue(undefined) })),
  ]);
});

describe("TasksPage + AddTaskModal integration", () => {
  it("allows creating a new task through the Add Task modal", async () => {
    const user = userEvent.setup();

    render(<TasksPage />);

    expect(screen.getByText("Istniejące zadanie")).toBeInTheDocument();

    const openButton = screen.getByRole("button", { name: /Dodaj zadanie/i });
    await user.click(openButton);

    const titleInput = screen.getByPlaceholderText(/Np\. Przygotować ofertę/i);
    const submitButton = screen.getByRole("button", { name: /Zapisz/i });

    expect(submitButton).toBeDisabled();

    await user.type(titleInput, "aa");

    expect(submitButton).toBeDisabled();
    expect(
      screen.getByText(/Tytuł musi mieć min\. 3 znaki/i)
    ).toBeInTheDocument();

    await user.clear(titleInput);
    await user.type(titleInput, newTaskTitle);

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUseCreateTaskMutation).toHaveBeenCalled();
    });

    const [createTaskFn] = mockUseCreateTaskMutation.mock.results[0].value as [
      (payload: CreateTaskPayload) => { unwrap: () => Promise<unknown> }
    ];

    expect(createTaskFn).toHaveBeenCalledTimes(1);
    expect(createTaskFn.mock.calls[0][0]).toMatchObject({
      title: newTaskTitle,
    });

    await screen.findByText(newTaskTitle);
  });
});
