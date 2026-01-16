import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("EditProjectModal - submit", () => {
  it("calls onSubmit with normalized patch and closes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EditProjectModal
        open={true}
        project={baseProject}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Strona www 2026/i);
    const submitBtn = screen.getByRole("button", { name: /Zapisz/i });

    await user.clear(nameInput);
    await user.type(nameInput, "Zmieniony projekt");

    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const [id, patch] = onSubmit.mock.calls[0];

    expect(id).toBe(baseProject.id);
    expect(patch).toMatchObject({
      name: "Zmieniony projekt",
      status: baseProject.status,
      start_date: null,
      end_date: null,
    });

    expect(onClose).toHaveBeenCalled();
  });
});
