import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AddProjectModal from "../../src/features/projects/components/AddProjectModal";

describe("AddProjectModal - validation", () => {
  it("disables submit and shows error when name is too short", async () => {
    const user = userEvent.setup();

    render(
      <AddProjectModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    const submit = screen.getByRole("button", { name: /Zapisz/i });
    expect(submit).toBeDisabled();

    const nameInput = screen.getByPlaceholderText(/Strona www 2026/i);
    await user.type(nameInput, "ab");

    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/Nazwa musi mieć min\. 3 znaki/i)
    ).toBeInTheDocument();
  });
});
