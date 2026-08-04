import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("presents the primary action for today's workout", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "今天，开始动起来" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "创建我的计划" }),
    ).toBeInTheDocument();
  });
});
