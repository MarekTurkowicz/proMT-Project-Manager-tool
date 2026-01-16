import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AddFundingModal from "../../src/features/fundings/components/AddFundingModal";

describe("AddFundingModal - submit", () => {
  it("calls onSubmit with normalized payload and closes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <AddFundingModal open={true} onClose={onClose} onSubmit={onSubmit} />
    );

    const nameInput = screen.getByPlaceholderText(/NCBR Grant 1\/2025/i);

    const typeSelect = screen.getByRole("combobox");
    await user.selectOptions(typeSelect, "grant");

    await user.click(screen.getByRole("button", { name: /Budżet/i }));

    const amountInput = screen.getByPlaceholderText(/250000.00/i);
    const submit = screen.getByRole("button", { name: /Dodaj/i });

    await user.type(nameInput, "Nowe finansowanie");
    await user.type(amountInput, "1000");

    await user.click(submit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0];

    expect(payload).toMatchObject({
      name: "Nowe finansowanie",
      amount_total: "1000",
      currency: "PLN",
      start_date: null,
      end_date: null,
      reporting_deadline: null,
    });

    expect(onClose).toHaveBeenCalled();
  });
});
