const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ===============================
   Strict Environment Variable Check
================================= */
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY is not set!");
  process.exit(1);
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/* ===============================
   Fetch PageSpeed Data
================================= */
async function fetchPageSpeed(url, strategy) {
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&strategy=${strategy}&key=${GOOGLE_API_KEY}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google API HTTP Error:", errorText);
    throw new Error("Google PageSpeed API request failed");
  }

  const data = await response.json();

  // If Google returns API-level error
  if (data.error) {
    console.error("Google API Error:", data.error);
    throw new Error(data.error.message || "Google API returned an error");
  }

  if (!data.lighthouseResult || !data.lighthouseResult.categories) {
    console.error("Invalid Lighthouse response:", data);
    throw new Error("Invalid Lighthouse response from Google");
  }

  const categories = data.lighthouseResult.categories;

  return {
    performance: categories.performance?.score != null
      ? Math.round(categories.performance.score * 100)
      : null,
    accessibility: categories.accessibility?.score != null
      ? Math.round(categories.accessibility.score * 100)
      : null,
    seo: categories.seo?.score != null
      ? Math.round(categories.seo.score * 100)
      : null,
    bestPractices: categories["best-practices"]?.score != null
      ? Math.round(categories["best-practices"].score * 100)
      : null,
  };
}

/* ===============================
   Audit Endpoint
================================= */
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
    console.error("Audit Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   Health Check Route
================================= */
app.get("/", (req, res) => {
  res.json({ ok: true, service: "devicely-pagespeed-proxy" });
});

/* ===============================
   Start Server
================================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});