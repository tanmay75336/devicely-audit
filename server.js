const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

require("dotenv").config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const API_KEY = (process.env.GOOGLE_API_KEY || "").trim();

if (!API_KEY) {
  console.warn("GOOGLE_API_KEY is not set. /audit will fail until it is configured.");
}

async function fetchPageSpeed(url, strategy) {
  if (!API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing on the server.");
  }

  try {
    const response = await axios.get(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
      {
        params: {
          url,
          key: API_KEY,
          strategy,
          category: ["performance", "accessibility", "seo", "best-practices"],
        },
        timeout: 60000,
      }
    );

    const categories = response.data.lighthouseResult.categories;

    return {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      seo: Math.round(categories.seo.score * 100),
      bestPractices: Math.round(categories["best-practices"].score * 100),
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;

      if (status === 429) {
        throw new Error("Google API quota exceeded (429).");
      }

      throw new Error(
        error.response.data?.error?.message || "Google API request failed."
      );
    }

    throw new Error("Network or timeout error.");
  }
}

app.post("/audit", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required." });
    }

    const mobile = await fetchPageSpeed(url, "mobile");
    const desktop = await fetchPageSpeed(url, "desktop");

    return res.json({
      mobile,
      desktop,
    });
  } catch (error) {
    console.error("Audit Error:", error.message);

    return res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "devicely-audit",
    hasGoogleApiKey: Boolean(API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`PageSpeed Audit Service running on port ${PORT}`);
});
