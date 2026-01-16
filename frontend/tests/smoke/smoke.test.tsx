import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

function Dummy() {
  return <h1>Hello Vitest</h1>;
}

describe("Smoke test", () => {
  it("renders simple component", () => {
    render(<Dummy />);
    expect(screen.getByText("Hello Vitest")).toBeInTheDocument();
  });
});
