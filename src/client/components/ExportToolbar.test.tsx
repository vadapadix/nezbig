import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExportToolbar } from "./ExportToolbar";
import { LanguageProvider } from "../context/LanguageContext";
import type { ScanReport } from "../../shared/types";

const png = vi.hoisted(() => vi.fn());
vi.mock("../utils/reportExport", () => ({ downloadReportPdf: vi.fn(), downloadReportPng: png }));
vi.mock("../utils/googleDrive", () => ({ saveReportToGoogleDrive: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });

it("keeps export disabled until PNG generation settles and reports a failure", async () => {
  let rejectExport!: (error: Error) => void;
  png.mockReturnValue(new Promise<void>((_resolve, reject) => { rejectExport = reject; }));
  const message = vi.fn();
  localStorage.setItem("nezbig_lang", "uk");
  render(<LanguageProvider><ExportToolbar report={{ id: "test", fileName: "test.txt" } as ScanReport} onMessage={message} /></LanguageProvider>);
  fireEvent.click(screen.getByRole("button", { name: "PNG" }));
  expect(screen.getByRole("button", { name: "PNG…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
  rejectExport(new Error("canvas failed"));
  await waitFor(() => expect(message).toHaveBeenCalledWith(expect.stringContaining("Не вдалося створити звіт"), "error"));
  expect(screen.getByRole("button", { name: "PNG" })).toBeEnabled();
});
