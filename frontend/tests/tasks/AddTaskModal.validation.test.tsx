import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("AddTaskModal - validation", () => {
  it("disables submit when title is too short", async () => {
    const user = userEvent.setup();

    render(
      <AddTaskModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const submit = screen.getByRole("button", { name: /Zapisz/i });
    expect(submit).toBeDisabled();

    const title = screen.getByPlaceholderText(/Np\./i);
    await user.type(title, "aa");

    expect(submit).toBeDisabled();
    expect(screen.getByText(/min\. 3 znaki/i)).toBeInTheDocument();
  });
});
