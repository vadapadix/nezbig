import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SessionRedirect } from "../../../src/client/components/SessionRedirect";
import { SESSION_INVALID_EVENT } from "../../../src/client/utils/apiClient";

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

describe("SessionRedirect", () => {
  it("opens login and preserves the requested local page", () => {
    render(
      <MemoryRouter initialEntries={["/history/report-1"]}>
        <SessionRedirect />
        <CurrentLocation />
      </MemoryRouter>
    );
    act(() => {
      window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/login?returnTo=%2Fhistory%2Freport-1");
  });
});
