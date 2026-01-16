import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import ProjectEditPage from "../../src/features/projects/ProjectEditPage";
import type { Project } from "../../src/features/projects/projectsApi";

const mockUseGetByIdQuery = vi.fn();
const mockUseUpdateMutation = vi.fn();

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "5" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/features/projects/projectsApi.ts", () => ({
  useGetByIdQuery: (id: number) => mockUseGetByIdQuery(id),
  useUpdateMutation: () => mockUseUpdateMutation(),
}));

const project: Project = {
  id: 5,
  name: "Proj",
  description: "Opis",
  status: "active",
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  funding_ids: [1, 2],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 10,
};

const updateUnwrap = vi.fn().mockResolvedValue(undefined);
const updateFn = vi.fn(() => ({ unwrap: updateUnwrap }));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseGetByIdQuery.mockReturnValue({
    data: project,
    isLoading: false,
    isError: false,
  });
  mockUseUpdateMutation.mockReturnValue([updateFn, { isLoading: false }]);
});

describe("ProjectEditPage", () => {
  it("prefills form and submits normalized patch", async () => {
    const user = userEvent.setup();

    render(<ProjectEditPage />);

    expect(
      screen.getByRole("heading", { name: /Edytuj projekt #5/i })
    ).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Proj") as HTMLInputElement;

    await user.clear(nameInput);
    await user.type(nameInput, "Nowa nazwa");

    const submit = screen.getByRole("button", { name: /Zapisz/i });
    await user.click(submit);

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    const [arg] = updateFn.mock.calls[0];

    expect(arg).toMatchObject({
      id: 5,
      patch: {
        name: "Nowa nazwa",
        start_date: project.start_date,
        end_date: project.end_date,
        owner: project.owner,
      },
    });

    expect(navigateMock).toHaveBeenCalledWith("/projects");
  });
});
