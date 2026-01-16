import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AddProjectModal from "../../src/features/projects/components/AddProjectModal";

describe("AddProjectModal - submit", () => {
  it("enables submit for valid name and calls onSubmit with payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <AddProjectModal open={true} onClose={onClose} onSubmit={onSubmit} />
    );

    const nameInput = screen.getByPlaceholderText(/Strona www 2026/i);
    const submitBtn = screen.getByRole("button", { name: /Zapisz/i });

    expect(submitBtn).toBeDisabled();

    await user.type(nameInput, "Nowy projekt");

    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0];

    expect(payload).toMatchObject({
      name: "Nowy projekt",
      description: undefined,
      start_date: null,
      end_date: null,
    });

    expect(onClose).toHaveBeenCalled();
  });
});
