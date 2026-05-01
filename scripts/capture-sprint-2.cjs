/* eslint-disable */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../docs/screenshots/sprint-2");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440-desktop", width: 1440, height: 900 },
  { name: "1024-tablet", width: 1024, height: 800 },
  { name: "390-mobile", width: 390, height: 844 },
];

const ROUTES = [
  { slug: "landing", url: "/scorecard" },
  { slug: "start", url: "/scorecard/start" },
];

// Seeded answers to deterministically populate the results page.
const SEED_ANSWERS = {
  "company.industry": "professional-services",
  "company.size": "51-200",
  "business.goal": "throughput",
  "business.constraint": 4,
  "friction.areas": [
    "data-reconciliation",
    "doc-review",
    "intake-discovery",
    "ops-handoffs",
  ],
  "friction.severity": 4,
  "systems.maturity": "core",
  "systems.documentation": 3,
  "ai.usage": "team",
  "ai.confidence": 4,
  "data.sensitivity": "client-confidential",
  "data.governance": 3,
  "urgency.timeline": "this-quarter",
  "urgency.investment": "75-200k",
  "contact.firstName": "Mira",
  "contact.lastName": "Reyes",
  "contact.role": "VP Operations",
  "contact.company": "Helio Health",
  "contact.email": "mira@example.com",
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  try {
    for (const v of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      });
      const page = await ctx.newPage();

      for (const r of ROUTES) {
        await page.goto("http://localhost:3000" + r.url, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(500);
        const fold = path.join(OUT, `${r.slug}-${v.name}-fold.png`);
        await page.screenshot({ path: fold, fullPage: false });
        const full = path.join(OUT, `${r.slug}-${v.name}-full.png`);
        await page.screenshot({ path: full, fullPage: true });
      }

      // Results page — seed localStorage first, then visit
      await page.goto("http://localhost:3000/scorecard", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate((answers) => {
        window.localStorage.setItem(
          "slate.scorecard.v1",
          JSON.stringify({
            answers,
            sectionIdx: 7,
            completedAt: new Date().toISOString(),
          }),
        );
      }, SEED_ANSWERS);
      await page.goto("http://localhost:3000/scorecard/results", {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(700);
      await page.screenshot({
        path: path.join(OUT, `results-${v.name}-fold.png`),
        fullPage: false,
      });
      await page.screenshot({
        path: path.join(OUT, `results-${v.name}-full.png`),
        fullPage: true,
      });

      await ctx.close();
      console.log(`captured ${v.name}`);
    }
  } finally {
    await browser.close();
  }
})();
