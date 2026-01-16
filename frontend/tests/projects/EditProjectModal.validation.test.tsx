import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import EditProjectModal from "../../src/features/projects/components/EditProjectModal";
import type { Project } from "../../src/features/types/project";

const baseProject: Project = {
  id: 1,
  name: "Projekt 1",
  description: "",
  status: "new",
  start_date: null,
  end_date: null,
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

describe("EditProjectModal - validation", () => {
  it("shows error and disables submit when name is too short", async () => {
    const user = userEvent.setup();

    render(
      <EditProjectModal
        open={true}
        project={baseProject}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Strona www 2026/i);
    const submitBtn = screen.getByRole("button", { name: /Zapisz/i });

    await user.clear(nameInput);
    await user.type(nameInput, "ab");

    expect(submitBtn).toBeDisabled();
    expect(
      screen.getByText(/Nazwa musi mieć min\. 3 znaki/i)
    ).toBeInTheDocument();
  });

  it("validates that end date is not before start", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <EditProjectModal
        open={true}
        project={baseProject}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const dateInputs = container.querySelectorAll('input[type="date"]');
    const startInput = dateInputs[0] as HTMLInputElement;
    const endInput = dateInputs[1] as HTMLInputElement;

    await user.clear(startInput);
    await user.type(startInput, "2024-02-10");
    await user.clear(endInput);
    await user.type(endInput, "2024-02-01");

    expect(
      screen.getByText(/Data końcowa nie może być wcześniejsza niż start/i)
    ).toBeInTheDocument();
  });
});
