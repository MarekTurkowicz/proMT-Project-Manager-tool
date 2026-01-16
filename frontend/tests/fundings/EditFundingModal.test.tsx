import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import EditFundingModal, {
  type Funding,
} from "../../src/features/fundings/components/EditFundingModal";

const baseFunding: Funding = {
  id: 1,
  name: "Grant 1",
  program: "Program",
  funder: "Funder",
  amount_total: "1000",
  currency: "PLN",
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  reporting_deadline: null,
  agreement_number: null,
  description: null,
  type: "grant",
};

describe("EditFundingModal", () => {
  it("shows validation error for too short name", async () => {
    const user = userEvent.setup();

    render(
      <EditFundingModal
        open={true}
        funding={baseFunding}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    const nameInput = screen.getByDisplayValue("Grant 1");
    const submit = screen.getByRole("button", { name: /Zapisz/i });

    await user.clear(nameInput);
    await user.type(nameInput, "a");

    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/Nazwa musi mieć min\. 2 znaki/i)
    ).toBeInTheDocument();
  });

  it("calls onSubmit with patch and closes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <EditFundingModal
        open={true}
        funding={baseFunding}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const nameInput = screen.getByDisplayValue("Grant 1");
    const submit = screen.getByRole("button", { name: /Zapisz/i });

    await user.clear(nameInput);
    await user.type(nameInput, "Zmieniony grant");

    await user.click(submit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const [id, patch] = onSubmit.mock.calls[0];

    expect(id).toBe(baseFunding.id);
    expect(patch).toMatchObject({
      name: "Zmieniony grant",
      currency: baseFunding.currency,
    });

    expect(onClose).toHaveBeenCalled();
  });
});
