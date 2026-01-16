import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import TasksPage from "../../src/features/tasks/pages/TaskPage.tsx";

const mockUseListTasksQuery = vi.fn();
const mockUseCreateTaskMutation = vi.fn();
const mockDelete = vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: (p: any) => mockUseListTasksQuery(p),
  useCreateTaskMutation: () => mockUseCreateTaskMutation(),
  usePickProjectsQuery: () => ({ data: [], isLoading: false }),
  usePickFundingsQuery: () => ({ data: [], isLoading: false }),
  useDeleteTaskMutation: () => [mockDelete],
  useUpdateTaskMutation: () => [vi.fn()],
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCreateTaskMutation.mockReturnValue([vi.fn()]);
  mockUseListTasksQuery.mockReturnValue({
    data: {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          title: "Task A",
          description: "Opis",
          status: "todo",
          priority: 2,
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    error: undefined,
    refetch: vi.fn(),
  });
});

describe("TaskPage - delete", () => {
  it("calls delete mutation after confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<TasksPage />);

    await user.click(screen.getByRole("button", { name: /Usuń/i }));
    expect(mockDelete).toHaveBeenCalled();
  });

  it("does not call delete mutation when confirm is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<TasksPage />);

    await user.click(screen.getByRole("button", { name: /Usuń/i }));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
