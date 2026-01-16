import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { renderWithRouter } from "../render";
import FundingsPage from "../../src/features/fundings/pages/FundingPage";
import type { Funding } from "../../src/features/types/funding";

const mockUseListFundingsQuery = vi.fn();
const mockUseCreateFundingMutation = vi.fn();
const mockUseUpdateFundingMutation = vi.fn();
const mockUseDeleteFundingMutation = vi.fn();

vi.mock("../../src/features/tasks/tasksApi.ts", () => ({
  useListTasksQuery: () => ({
    data: { results: [], next: null },
    isFetching: false,
    isLoading: false,
  }),
  useCreateTaskMutation: () => [vi.fn()],
  useDeleteTaskMutation: () => [
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue(undefined) })),
  ],
  useUpdateTaskMutation: () => [
    vi.fn(() => ({ unwrap: vi.fn().mockResolvedValue(undefined) })),
  ],
  usePickProjectsQuery: () => ({ data: [], isLoading: false }),
  usePickFundingsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../src/features/api/fundingApi.ts", () => ({
  useListFundingsQuery: (p: any) => mockUseListFundingsQuery(p),
  useCreateFundingMutation: () => mockUseCreateFundingMutation(),
  useUpdateFundingMutation: () => mockUseUpdateFundingMutation(),
  useDeleteFundingMutation: () => mockUseDeleteFundingMutation(),
}));

const sampleFunding: Funding = {
  id: 1,
  name: "Grant 1",
  program: "Program X",
  funder: "NCBR",
  amount_total: "1000",
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  type: "grant",
  currency: "PLN",
  agreement_number: null,
  reporting_deadline: null,
  description: null,
  created_at: "2024-01-01T00:00:00Z",
};

let refetchMock: ReturnType<typeof vi.fn>;
const deleteUnwrap = vi.fn().mockResolvedValue(undefined);
const deleteFn = vi.fn(() => ({ unwrap: deleteUnwrap }));

beforeEach(() => {
  vi.clearAllMocks();

  refetchMock = vi.fn();

  mockUseListFundingsQuery.mockReturnValue({
    data: {
      count: 1,
      next: null,
      previous: null,
      results: [sampleFunding],
    },
    isLoading: false,
    error: undefined,
    refetch: refetchMock,
  });

  mockUseCreateFundingMutation.mockReturnValue([vi.fn()]);
  mockUseUpdateFundingMutation.mockReturnValue([vi.fn()]);
  mockUseDeleteFundingMutation.mockReturnValue([deleteFn]);
});

describe("FundingsPage", () => {
  it("renders list and calls deleteFunding when confirmed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithRouter(<FundingsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Finansowania/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Grant 1")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", { name: /Usuń/i });
    await user.click(deleteButton);

    expect(deleteFn).toHaveBeenCalledWith(sampleFunding.id);
    expect(deleteUnwrap).toHaveBeenCalled();
    expect(refetchMock).toHaveBeenCalled();
  });
});
