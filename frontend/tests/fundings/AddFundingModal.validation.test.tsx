import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AddFundingModal from "../../src/features/fundings/components/AddFundingModal";

describe("AddFundingModal - validation", () => {
  it("disables submit and shows error when name is too short", async () => {
    const user = userEvent.setup();

    render(
      <AddFundingModal
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    const submit = screen.getByRole("button", { name: /Dodaj/i });
    expect(submit).toBeDisabled();

    const nameInput = screen.getByPlaceholderText(/NCBR Grant 1\/2025/i);
    await user.type(nameInput, "a");

    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/Nazwa musi mieć min\. 2 znaki/i)
    ).toBeInTheDocument();
  });

  it("validates that end date is not before start", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <AddFundingModal
        open={true}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    );

    const nameInput = screen.getByPlaceholderText(/NCBR Grant 1\/2025/i);
    await user.type(nameInput, "Grant ABC");
    const typeSelect = screen.getByRole("combobox");
    await user.selectOptions(typeSelect, "grant");

    await user.click(screen.getByRole("button", { name: /Daty/i }));

    const dateInputs = container.querySelectorAll('input[type="date"]');
    const startInput = dateInputs[0] as HTMLInputElement;
    const endInput = dateInputs[1] as HTMLInputElement;

    await user.type(startInput, "2024-02-10");
    await user.type(endInput, "2024-02-01");

    const submit = screen.getByRole("button", { name: /Dodaj/i });
    await user.click(submit);

    expect(
      await screen.findByText(
        /Data końcowa nie może być wcześniejsza niż start/i
      )
    ).toBeInTheDocument();
  });
});
