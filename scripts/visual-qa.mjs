import { chromium } from "file:///C:/Users/Seth/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve("docs/screenshots");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "dark" });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));

await page.goto("http://127.0.0.1:1420/", { waitUntil: "networkidle" });
await page.getByText("Refactor authentication flow", { exact: true }).first().waitFor();
await page.getByRole("button", { name: "Claude Sonnet 4.6" }).click();
await page.getByText("Available through your providers").waitFor();
await page.locator(".app-name").click();
await page.locator(".chat-scroll").evaluate((element) => { element.scrollTop = 0; });
await page.screenshot({ path: resolve(outputDir, "cline-chat-main.png") });

await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("heading", { name: "Appearance" }).waitFor();
await page.getByRole("button", { name: "azure accent" }).click();
const accentAfterPreset = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
if (accentAfterPreset !== "#50a7ff") throw new Error(`Accent preset did not apply: ${accentAfterPreset}`);
await page.locator('input[type="color"]').fill("#b66cff");
const accentAfterCustom = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
if (accentAfterCustom !== "#b66cff") throw new Error(`Custom accent did not apply: ${accentAfterCustom}`);
await page.screenshot({ path: resolve(outputDir, "cline-chat-settings.png") });
await page.getByRole("button", { name: "Close settings" }).click();

await page.getByRole("button", { name: "New chat" }).click();
await page.getByLabel("Message Cline").fill("Summarize the attached context and recommend the next step.");
await page.getByRole("button", { name: "Send message" }).click();
await page.getByText("First pass").waitFor({ timeout: 10_000 });
await page.getByText("Streaming", { exact: true }).waitFor({ state: "hidden", timeout: 15_000 });

await page.reload({ waitUntil: "networkidle" });
const persistedAccent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
if (persistedAccent !== "#b66cff") throw new Error(`Custom accent did not persist: ${persistedAccent}`);

await browser.close();
console.log(JSON.stringify({
  viewport: "1440x900",
  screenshots: ["docs/screenshots/cline-chat-main.png", "docs/screenshots/cline-chat-settings.png"],
  checks: ["history", "model menu", "settings", "preset accent", "custom accent", "accent persistence", "new chat", "message streaming"],
  consoleErrors,
}, null, 2));
