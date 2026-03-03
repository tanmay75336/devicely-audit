const express = require("express");
const cors = require("cors");
const lighthouse = require("lighthouse");
const puppeteer = require("puppeteer");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const PORT = process.env.PORT || 10000;

async function runLighthouse(url, strategy) {
  let browser;

  try {
    // Launch Puppeteer using installed Chromium
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote"
      ]
    });

    // Get debugging port from wsEndpoint
    const wsEndpoint = browser.wsEndpoint();
    const port = new URL(wsEndpoint).port;

    const options = {
      port: port,
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
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("Failed to close browser:", e.message);
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

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format." });
    }

    const mobile = await runLighthouse(url, "mobile");
    const desktop = await runLighthouse(url, "desktop");

    return res.json({ mobile, desktop });

  } catch (error) {
    console.error("FULL ERROR:", error);
    return res.status(500).json({
      error: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "devicely-lighthouse",
    mode: "puppeteer-lighthouse"
  });
});

app.listen(PORT, () => {
  console.log(`Lighthouse Service running on port ${PORT}`);
});