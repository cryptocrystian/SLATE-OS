/* eslint-disable */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../docs/screenshots/sprint-4");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440-desktop", width: 1440, height: 900 },
  { name: "1024-tablet", width: 1024, height: 800 },
  { name: "390-mobile", width: 390, height: 844 },
];

const ROUTES = [
  { slug: "engagements-list", url: "/app/engagements" },
  { slug: "engagement-setup", url: "/app/engagements/atlas-aios-q2" },
  { slug: "engagement-intake", url: "/app/engagements/helio-aios-q2" },
  { slug: "engagement-report", url: "/app/engagements/quanta-aios-q1" },
  { slug: "engagement-proposal", url: "/app/engagements/caldera-aios-q1" },
  { slug: "lead-detail-with-engagement", url: "/app/leads/helio-health" },
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
