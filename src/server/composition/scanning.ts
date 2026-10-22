import pino from "pino";
import { ScanService } from "../application/scanning/ScanService.js";
import { WebSearchGateway } from "../infrastructure/search/WebSearchGateway.js";
export const scanService = new ScanService(new WebSearchGateway(), pino({ level: process.env.LOG_LEVEL || "info" }));
