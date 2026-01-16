import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AddTaskModal from "../../src/features/tasks/components/AddTaskModal.tsx";

const mockUsePickProjectsQuery = vi.fn();
const mockUsePickFundingsQuery = vi.fn();

vi.mock("../../src/features/tasks/tasksApi.ts", () => ({
  usePickProjectsQuery: () => mockUsePickProjectsQuery(),
  usePickFundingsQuery: () => mockUsePickFundingsQuery(),
}));

beforeEach(() => {
  mockUsePickProjectsQuery.mockReturnValue({ data: [], isLoading: false });
  mockUsePickFundingsQuery.mockReturnValue({ data: [], isLoading: false });
});

describe("AddTaskModal - submit", () => {
  it("enables submit for valid title and calls onSubmit with payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <AddTaskModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Np\./i);
    const submitBtn = screen.getByRole("button", { name: /Zapisz/i });

    expect(submitBtn).toBeDisabled();

    await user.type(titleInput, "Nowe zadanie");

    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0];

    expect(payload).toMatchObject({
      title: "Nowe zadanie",
      description: undefined,
      status: "todo",
      priority: 2,
      start_date: null,
      due_date: null,
      est_hours: null,
      cost_amount: null,
      cost_currency: "PLN",
      receipt_url: undefined,
      receipt_note: undefined,
      project: null,
      funding: null,
      project_funding: null,
    });

    expect(onClose).toHaveBeenCalled();
  });
});
