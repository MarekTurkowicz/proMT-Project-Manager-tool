import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { renderWithRouter } from "../render";
import ProjectsPage from "../../src/features/projects/pages/ProjectsPage";
import type { Project } from "../../src/features/types/project";

const mockUseProjectsQuery = vi.fn();
const mockUseCreateMutation = vi.fn();
const mockUseDeleteMutation = vi.fn();
const mockUseUpdateMutation = vi.fn();
const mockUseMeQuery = vi.fn();

const sampleProject: Project = {
  id: 1,
  name: "Sample project",
  description: "Opis",
  status: "active",
  start_date: "2025-01-01",
  end_date: "2025-01-31",
  funding_ids: [1, 2],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

let refetchMock: ReturnType<typeof vi.fn>;
const deleteUnwrap = vi.fn().mockResolvedValue(undefined);
const deleteFn = vi.fn(() => ({ unwrap: deleteUnwrap }));

vi.mock("../../src/features/api/projectsApi.ts", () => ({
  useProjectsQuery: (params: any) => mockUseProjectsQuery(params),
  useCreateMutation: () => mockUseCreateMutation(),
  useDeleteMutation: () => mockUseDeleteMutation(),
  useUpdateMutation: () => mockUseUpdateMutation(),
}));

vi.mock("../../src/features/auth/authApi.ts", () => ({
  useMeQuery: () => mockUseMeQuery(),
}));

beforeEach(() => {
  vi.clearAllMocks();

  refetchMock = vi.fn();

  mockUseMeQuery.mockReturnValue({
    data: { id: 1, username: "user", email: "u@example.com", is_staff: false },
    isLoading: false,
    isError: false,
  });

  mockUseProjectsQuery.mockReturnValue({
    data: {
      count: 1,
      next: null,
      previous: null,
      results: [sampleProject],
    },
    isLoading: false,
    error: undefined,
    refetch: refetchMock,
  });

  mockUseCreateMutation.mockReturnValue([vi.fn()]);
  mockUseUpdateMutation.mockReturnValue([vi.fn()]);
  mockUseDeleteMutation.mockReturnValue([deleteFn]);
});

describe("ProjectsPage", () => {
  it("renders list and calls delete mutation when confirmed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithRouter(<ProjectsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Projects/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Sample project")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", { name: /Delete/i });
    await user.click(deleteButton);

    expect(deleteFn).toHaveBeenCalledWith(sampleProject.id);
    expect(deleteUnwrap).toHaveBeenCalled();
    expect(refetchMock).toHaveBeenCalled();
  });
});
