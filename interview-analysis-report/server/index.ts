import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { convertMdToJson } from "./convert.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8000;
const DATA_DIR = path.resolve(__dirname, "../../");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

// CORS headers
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

interface ReportListItem {
  name: string;
  position: string;
  date: string;
}

function findReports(): ReportListItem[] {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith("_analysis_data.json"))
    .sort();

  return files.map((file) => {
    const name = file.replace("_analysis_data.json", "");
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      const meta = data.meta || {};
      return {
        name,
        position: meta.position || name,
        date: meta.date || "",
      };
    } catch {
      return { name, position: name, date: "" };
    }
  });
}

function loadReport(name: string): object | null {
  const filePath = path.join(DATA_DIR, `${name}_analysis_data.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// GET /api/reports - list all reports
app.get("/api/reports", (_req, res) => {
  const reports = findReports();
  res.json({ reports });
});

// GET /api/reports/:name - get specific report
app.get("/api/reports/:name", (req, res) => {
  const data = loadReport(req.params.name);
  if (!data) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(data);
});

// POST /api/convert - convert markdown to JSON
app.post("/api/convert", async (req, res) => {
  try {
    const mdContent =
      typeof req.body === "string" ? req.body : req.body?.markdown;
    if (!mdContent) {
      res.status(400).json({ error: "Missing markdown content in request body" });
      return;
    }

    const saveName = req.body?.name;
    const result = await convertMdToJson(mdContent);

    if (saveName) {
      const outPath = path.join(DATA_DIR, `${saveName}_analysis_data.json`);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
      console.log(`[API] Saved: ${outPath}`);
    }

    res.json(result);
  } catch (err: any) {
    console.error("[API] Convert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
  console.log(`  GET  /api/reports         - List reports`);
  console.log(`  GET  /api/reports/{name}   - Get report data`);
  console.log(`  POST /api/convert          - Convert markdown to JSON`);
  console.log(`Data directory: ${DATA_DIR}`);
  const reports = findReports();
  console.log(
    `Found ${reports.length} report(s): ${JSON.stringify(reports.map((r) => r.name))}`
  );
});
