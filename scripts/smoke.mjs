import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"],
});
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("GLB panels missing")) failures.push(message.text());
  });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1500);

  await page.locator("div.h-dvh").first().evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const bench = page.getByRole("button", { name: "Bench", exact: true });
  await bench.waitFor({ state: "visible", timeout: 10000 });
  await bench.click();
  await page.getByText("Construction lab").waitFor({ state: "visible", timeout: 10000 });

  const explode = page.getByRole("button", { name: /Explode/ });
  await explode.click();
  if ((await explode.getAttribute("aria-pressed")) !== "true") throw new Error("Explode control did not activate.");

  await page.getByRole("slider", { name: "Explosion intensity" }).evaluate((element) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(element, "0.55");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByText("55%", { exact: true }).waitFor({ state: "visible", timeout: 3000 });

  const assemble = page.getByRole("button", { name: /Assemble/ });
  await assemble.click();
  if ((await assemble.getAttribute("aria-pressed")) !== "true") throw new Error("Assemble control did not activate.");

  await page.getByRole("button", { name: /Hide selection/ }).click();
  const showSelection = page.getByRole("button", { name: /Show selection/ });
  if (!(await showSelection.isEnabled())) throw new Error("Hide selection did not update the visibility control.");
  await showSelection.click();

  await page.getByRole("slider", { name: "Studio lighting intensity" }).evaluate((element) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(element, "1.25");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByText("125%", { exact: true }).waitFor({ state: "visible", timeout: 3000 });

  for (const label of ["Blueprint", "Turntable", "Light sweep"]) {
    const control = page.getByRole("button", { name: new RegExp(label) });
    await control.click();
    if ((await control.getAttribute("aria-pressed")) !== "true") throw new Error(`${label} control did not activate.`);
  }
  await page.getByRole("button", { name: /Compare original/ }).click();
  const original = page.getByRole("button", { name: /Showing original/ });
  if ((await original.getAttribute("aria-pressed")) !== "true") throw new Error("Original comparison did not activate.");

  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  mobile.setDefaultTimeout(10000);
  mobile.setDefaultNavigationTimeout(15000);
  mobile.on("pageerror", (error) => failures.push(error.message));
  await mobile.goto(baseURL, { waitUntil: "domcontentloaded" });
  await mobile.locator("canvas").waitFor({ state: "visible", timeout: 15000 });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error("Mobile layout has horizontal overflow.");

  if (failures.length) throw new Error(`Browser errors: ${failures.join(" | ")}`);
  console.log("PASS: desktop 3D scene loaded; explode/assemble, intensity, blueprint, turntable, light sweep and original comparison responded; mobile canvas has no horizontal overflow.");
} finally {
  await browser.close();
}
