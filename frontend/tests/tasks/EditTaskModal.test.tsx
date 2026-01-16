import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import EditTaskModal from "../../src/features/tasks/components/EditTaskModal.tsx";
import type { Task } from "../../src/features/tasks/types";

const mockUsePickProjectsQuery = vi.fn();
const mockUsePickFundingsQuery = vi.fn();
const mockUseListUsersQuery = vi.fn();

vi.mock("../../src/features/tasks/tasksApi.ts", () => ({
  usePickProjectsQuery: () => mockUsePickProjectsQuery(),
  usePickFundingsQuery: () => mockUsePickFundingsQuery(),
}));

vi.mock("../../src/features/api/usersApi.ts", () => ({
  useListUsersQuery: () => mockUseListUsersQuery(),
}));

const baseTask: Task = {
  id: 1,
  title: "Task 1",
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
  scope_project: null,
  scope_funding: null,
  scope_project_funding: null,
  project_name: null,
  funding_name: null,
  assignees: [],
};

beforeEach(() => {
  mockUsePickProjectsQuery.mockReturnValue({ data: [], isLoading: false });
  mockUsePickFundingsQuery.mockReturnValue({ data: [], isLoading: false });
  mockUseListUsersQuery.mockReturnValue({ data: [], isLoading: false });
});

describe("EditTaskModal", () => {
  it("shows validation error when title is too short", async () => {
    const user = userEvent.setup();

    render(
      <EditTaskModal
        open={true}
        task={baseTask}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Przygotować ofertę/i);
    const submit = screen.getByRole("button", { name: /Zapisz/i });

    await user.clear(titleInput);
    await user.type(titleInput, "aa");

    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/Tytuł musi mieć min\. 3 znaki/i)
    ).toBeInTheDocument();
  });

  it("validates that due date is not before start", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <EditTaskModal
        open={true}
        task={baseTask}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    const dateInputs = container.querySelectorAll('input[type="date"]');
    const startInput = dateInputs[0] as HTMLInputElement;
    const dueInput = dateInputs[1] as HTMLInputElement;

    await user.type(startInput, "2024-02-10");
    await user.type(dueInput, "2024-02-01");

    expect(
      screen.getByText(/Data końcowa nie może być wcześniejsza niż start/i)
    ).toBeInTheDocument();
  });

  it("calls onSubmit with patch and closes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EditTaskModal
        open={true}
        task={baseTask}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Przygotować ofertę/i);
    const submit = screen.getByRole("button", { name: /Zapisz/i });

    await user.clear(titleInput);
    await user.type(titleInput, "Zmienione zadanie");

    await user.click(submit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const [id, patch] = onSubmit.mock.calls[0];

    expect(id).toBe(baseTask.id);
    expect(patch).toMatchObject({
      title: "Zmienione zadanie",
      project: null,
      funding: null,
      project_funding: null,
    });

    expect(onClose).toHaveBeenCalled();
  });
});
