import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "../../../render";

import LoginPage from "../../../../src/features/auth/LoginPage";

const mockUseCsrfQuery = vi.fn();
const mockUseLoginMutation = vi.fn();
const mockUseMeQuery = vi.fn();

vi.mock("../../../../src/features/auth/authApi.ts", () => ({
  useCsrfQuery: () => mockUseCsrfQuery(),
  useLoginMutation: () => mockUseLoginMutation(),
  useMeQuery: () => mockUseMeQuery(),
}));

beforeEach(() => {
  mockUseCsrfQuery.mockReturnValue({});
  mockUseMeQuery.mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
  });
  mockUseLoginMutation.mockReturnValue([vi.fn(), { isLoading: false }]);
});

describe("LoginPage", () => {
  it("renders login UI", () => {
    renderWithRouter(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: /zaloguj się/i })
    ).toBeInTheDocument();
  });

  it("allows typing into inputs (if present)", async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const inputs = screen.getAllByRole("textbox");
    if (inputs.length > 0) {
      await user.type(inputs[0], "admin");
      expect(inputs[0]).toHaveValue("admin");
    }
  });
});
