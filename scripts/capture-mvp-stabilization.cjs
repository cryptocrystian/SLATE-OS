/* eslint-disable */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../docs/screenshots/mvp-stabilization");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440-desktop", width: 1440, height: 900 },
  { name: "1024-tablet", width: 1024, height: 800 },
  { name: "390-mobile", width: 390, height: 844 },
];

// Seeded answers for /scorecard/results
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

const ROUTES = [
  // Public
  { slug: "scorecard", url: "/scorecard" },
  { slug: "scorecard-start", url: "/scorecard/start" },
  { slug: "scorecard-results", url: "/scorecard/results" },
  // Core internal
  { slug: "app", url: "/app" },
  { slug: "leads", url: "/app/leads" },
  { slug: "engagements", url: "/app/engagements" },
  // Quanta path (report-stage demo)
  { slug: "quanta-engagement", url: "/app/engagements/quanta-aios-q1" },
  { slug: "quanta-findings", url: "/app/engagements/quanta-aios-q1/findings" },
  { slug: "quanta-opportunities", url: "/app/engagements/quanta-aios-q1/opportunities" },
  { slug: "quanta-roadmap", url: "/app/engagements/quanta-aios-q1/roadmap" },
  { slug: "quanta-report", url: "/app/engagements/quanta-aios-q1/report" },
  { slug: "quanta-proposal", url: "/app/engagements/quanta-aios-q1/proposal" },
  // Caldera path (mature demo)
  { slug: "caldera-report", url: "/app/engagements/caldera-aios-q1/report" },
  { slug: "caldera-proposal", url: "/app/engagements/caldera-aios-q1/proposal" },
  // Empty-state regression checks
  { slug: "helio-proposal-empty", url: "/app/engagements/helio-aios-q2/proposal" },
  { slug: "atlas-report-empty", url: "/app/engagements/atlas-aios-q2/report" },
];

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

      // Pre-seed localStorage so /scorecard/results renders.
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

      for (const r of ROUTES) {
        await page.goto("http://localhost:3000" + r.url, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(450);
        await page.screenshot({
          path: path.join(OUT, `${r.slug}-${v.name}-fold.png`),
          fullPage: false,
        });
        await page.screenshot({
          path: path.join(OUT, `${r.slug}-${v.name}-full.png`),
          fullPage: true,
        });
      }

      await ctx.close();
      console.log(`captured ${v.name}`);
    }
  } finally {
    await browser.close();
  }
})();
