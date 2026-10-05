// scripts/export-favicon.ts — renders brand/favicon.svg to public/favicon-32.png (DP-UI WU-UI-02).
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("brand/favicon.svg", "utf8");
const sized = svg.replace("<svg ", '<svg width="32" height="32" ');
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 32, height: 32 } })).newPage();
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0"><div style="width:32px;height:32px">${sized}</div></body></html>`,
  );
  await page.screenshot({ path: "public/favicon-32.png", omitBackground: true });
  console.log("wrote public/favicon-32.png");
} finally {
  await browser.close();
}
