import { Router } from "express";
import { getUserReports, getReport, deleteUserReport, clearUserHistory, syncUserReports, } from "./db.js";
const router = Router();
// ─── GET /api/history: List user's scan history ──────────────
router.get("/", async (req, res) => {
    try {
        if (!req.user) {
            res.json([]);
            return;
        }
        const reports = await getUserReports(req.user.id, 100);
        res.json(reports);
    }
    catch {
        res.status(500).json({ error: "Помилка при завантаженні історії." });
    }
});
// ─── GET /api/history/:id: Get full report by ID ─────────────
router.get("/:id", async (req, res) => {
    try {
        const rawId = req.params.id;
        const reportId = Array.isArray(rawId) ? rawId[0] : rawId;
        if (!reportId) {
            res.status(400).json({ error: "Не вказано ID звіту." });
            return;
        }
        const report = await getReport(reportId);
        if (!report) {
            res.status(404).json({ error: "Звіт не знайдено." });
            return;
        }
        res.json(report);
    }
    catch {
        res.status(500).json({ error: "Помилка при отриманні звіту." });
    }
});
// ─── DELETE /api/history/:id: Remove single scan from user's account ──
router.delete("/:id", async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Необхідна авторизація." });
            return;
        }
        const rawId = req.params.id;
        const reportId = Array.isArray(rawId) ? rawId[0] : rawId;
        if (!reportId) {
            res.status(400).json({ error: "Не вказано ID звіту." });
            return;
        }
        await deleteUserReport(req.user.id, reportId);
        res.json({ ok: true, id: reportId });
    }
    catch {
        res.status(500).json({ error: "Помилка при видаленні звіту." });
    }
});
// ─── DELETE /api/history: Clear all scans in user's account ───
router.delete("/", async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Необхідна авторизація." });
            return;
        }
        await clearUserHistory(req.user.id);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: "Помилка при очищенні історії." });
    }
});
// ─── POST /api/history/sync: Sync browser localStorage scans to account ──
router.post("/sync", async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Необхідна авторизація." });
            return;
        }
        const items = req.body?.items;
        if (!Array.isArray(items)) {
            res.status(400).json({ error: "Очікується масив items." });
            return;
        }
        // Limit to syncing up to 50 local items at once to prevent oversized payloads
        const safeItems = items.slice(0, 50).filter((it) => it && typeof it.id === "string");
        const merged = await syncUserReports(req.user.id, safeItems);
        res.json({ ok: true, items: merged });
    }
    catch {
        res.status(500).json({ error: "Помилка при синхронізації історії." });
    }
});
export const historyRouter = router;
