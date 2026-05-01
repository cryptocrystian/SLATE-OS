/* eslint-disable */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.resolve(__dirname, "../docs/screenshots/sprint-1");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440-desktop", width: 1440, height: 900 },
  { name: "1024-tablet", width: 1024, height: 800 },
  { name: "390-mobile", width: 390, height: 844 },
];

const URL = "http://localhost:3000/app";

(async () => {
  const browser = await chromium.launch({
    executablePath:
      "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  try {
    for (const v of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      });
      const page = await ctx.newPage();
      await page.goto(URL, { waitUntil: "networkidle" });
      // Give fonts + layout a moment to settle
      await page.waitForTimeout(500);

      // Above-the-fold (viewport-only)
      const fold = path.join(OUT, `${v.name}-fold.png`);
      await page.screenshot({ path: fold, fullPage: false });

      // Full page
      const full = path.join(OUT, `${v.name}-full.png`);
      await page.screenshot({ path: full, fullPage: true });

      // Mobile-only: capture drawer open state
      if (v.width <= 600) {
        const menu = page.locator('button[aria-label="Toggle navigation"]');
        if (await menu.count()) {
          await menu.click();
          await page.waitForTimeout(350);
          const drawer = path.join(OUT, `${v.name}-drawer.png`);
          await page.screenshot({ path: drawer, fullPage: false });
          // close
          const close = page.locator('button[aria-label="Close navigation"]');
          if (await close.count()) await close.click();
        }
      }

      await ctx.close();
      console.log(`captured ${v.name}`);
    }
  } finally {
    await browser.close();
  }
})();
