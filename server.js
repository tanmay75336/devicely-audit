const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY is not set!");
  process.exit(1);
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

async function fetchPageSpeed(url, strategy) {
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&strategy=${strategy}${GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : ""}`;

  const response = await fetch(endpoint);
  const data = await response.json();

  if (!data.lighthouseResult) {
    throw new Error(data.error?.message || "Failed to fetch PageSpeed data");
  }

  const categories = data.lighthouseResult.categories;

  return {
    performance: Math.round(categories.performance.score * 100),
    accessibility: Math.round(categories.accessibility.score * 100),
    seo: Math.round(categories.seo.score * 100),
    bestPractices: Math.round(categories["best-practices"].score * 100),
  };
}

app.post("/audit", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const [mobile, desktop] = await Promise.all([
      fetchPageSpeed(url, "mobile"),
      fetchPageSpeed(url, "desktop"),
    ]);

    res.json({ mobile, desktop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({ ok: true, service: "devicely-pagespeed-proxy" });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});