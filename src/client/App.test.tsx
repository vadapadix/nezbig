import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the checker workspace", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /незбіг/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/текст для перевірки/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /запустити перевірку/i })).toBeInTheDocument();
  });
});
