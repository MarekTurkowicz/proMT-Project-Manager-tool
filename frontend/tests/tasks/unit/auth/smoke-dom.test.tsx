import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("DOM matchers", () => {
  it("supports jest-dom matchers", () => {
    render(<input defaultValue="abc" aria-label="inp" />);
    expect(screen.getByLabelText("inp")).toBeInTheDocument();
    expect(screen.getByLabelText("inp")).toHaveValue("abc");
  });
});
