const express = require("express");
const cors = require("cors");
const lighthouse = require("lighthouse").default;
const puppeteer = require("puppeteer");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function runLighthouse(url, strategy) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const wsEndpoint = browser.wsEndpoint();
    const port = new URL(wsEndpoint).port;

    const runnerResult = await lighthouse(url, {
      port,
      output: "json",
      onlyCategories: [
        "performance",
        "accessibility",
        "seo",
        "best-practices"
      ],
      emulatedFormFactor: strategy
    });

    const categories = runnerResult.lhr.categories;

    return {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      seo: Math.round(categories.seo.score * 100),
      bestPractices: Math.round(categories["best-practices"].score * 100)
    };

  } finally {
    if (browser) await browser.close();
  }
}

app.post("/audit", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    const mobile = await runLighthouse(url, "mobile");
    const desktop = await runLighthouse(url, "desktop");

    res.json({ mobile, desktop });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({ ok: true, platform: "railway" });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});