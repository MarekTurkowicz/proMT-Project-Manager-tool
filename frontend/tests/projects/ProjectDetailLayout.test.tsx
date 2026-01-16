import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import ProjectDetailLayout from "../../src/features/projects/pages/ProjectDetailLayout";
import type { Project } from "../../src/features/types/project";

const mockUseGetByIdQuery = vi.fn();

vi.mock("../../src/features/api/projectsApi.ts", () => ({
  useGetByIdQuery: (id: number) => mockUseGetByIdQuery(id),
}));

const project: Project = {
  id: 42,
  name: "Detail project",
  description: "Opis",
  status: "active",
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  funding_ids: [],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  owner: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseGetByIdQuery.mockReturnValue({
    data: project,
    isLoading: false,
    isError: false,
  });
});

describe("ProjectDetailLayout", () => {
  it("renders project header and tabs when project is loaded", () => {
    render(
      <MemoryRouter initialEntries={["/projects/42/overview"]}>
        <Routes>
          <Route path="/projects/:id/*" element={<ProjectDetailLayout />}>
            <Route path="overview" element={<div>OVERVIEW TAB</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /Detail project/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByText("OVERVIEW TAB")).toBeInTheDocument();
  });
});
