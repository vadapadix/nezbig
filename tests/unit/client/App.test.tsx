import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../../../src/client/App";

describe("App", () => {
  it("renders the checker workspace", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/nezbig|незбіг/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /run plagiarism scan|запустити перевірку/i })).toBeInTheDocument();
  });
});
