import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import ProtectedRoute from "../../../../src/features/auth/ProtectedRoute";

const mockUseMeQuery = vi.fn();

vi.mock("../../../../src/features/auth/authApi.ts", () => ({
  useMeQuery: () => mockUseMeQuery(),
}));

beforeEach(() => {
  mockUseMeQuery.mockReset();
});

describe("ProtectedRoute", () => {
  it("shows loading state when me query is loading", () => {
    mockUseMeQuery.mockReturnValue({ isLoading: true, isError: false });

    render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/ładowanie/i)).toBeInTheDocument();
  });

  it("renders children when user is authenticated (no error)", () => {
    mockUseMeQuery.mockReturnValue({ isLoading: false, isError: false });

    render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Private content")).toBeInTheDocument();
  });

  it("redirects to /login when me query is in error state", () => {
    mockUseMeQuery.mockReturnValue({ isLoading: false, isError: true });

    render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });
});
