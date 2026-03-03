const express = require("express");
const cors = require("cors");
const lighthouse = require("lighthouse");
const chromeLauncher = require("chrome-launcher");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const PORT = process.env.PORT || 10000;

async function runLighthouse(url, strategy) {
  let chrome;

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote"
      ]
    });

    const options = {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: [
        "performance",
        "accessibility",
        "seo",
        "best-practices"
      ],
      emulatedFormFactor: strategy === "mobile" ? "mobile" : "desktop"
    };

    const runnerResult = await lighthouse(url, options);

    const categories = runnerResult.lhr.categories;

    return {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      seo: Math.round(categories.seo.score * 100),
      bestPractices: Math.round(categories["best-practices"].score * 100)
    };

  } catch (err) {
    console.error("LIGHTHOUSE INTERNAL ERROR:", err);
    throw new Error("Lighthouse execution failed: " + err.message);
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch (e) {
        console.error("Failed to kill Chrome:", e.message);
      }
    }
  }
}

app.post("/audit", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required." });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format." });
    }

    const mobile = await runLighthouse(url, "mobile");
    const desktop = await runLighthouse(url, "desktop");

    return res.json({ mobile, desktop });

  } catch (error) {
    console.error("FULL LIGHTHOUSE ERROR:", error);

    return res.status(500).json({
      error: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "devicely-lighthouse",
    mode: "direct-lighthouse"
  });
});

app.listen(PORT, () => {
  console.log(`Lighthouse Service running on port ${PORT}`);
});