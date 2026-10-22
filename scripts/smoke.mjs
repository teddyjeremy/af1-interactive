import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"],
});
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
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
  const customise = page.getByRole("button", { name: "Customise yours", exact: true });
  await customise.waitFor({ state: "visible", timeout: 10000 });
  await customise.click({ force: true });
  await page.locator(".customizer-panel").waitFor({ state: "visible", timeout: 5000 });
  const panelWidth = await page.locator(".customizer-panel").evaluate((element) => element.getBoundingClientRect().width);
  if (panelWidth < 300) throw new Error(`Customiser panel is too narrow: ${panelWidth}px`);

  for (const label of ["YOUR PAIR", "Choose a colourway", "Colour", "Material finish", "Details", "View your pair", "Size"]) {
    await page.getByText(label, { exact: true }).first().waitFor({ state: "visible", timeout: 5000 });
  }

  await page.getByRole("button", { name: "suede", exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Add to bag", exact: true }).click({ force: true });
  await page.getByRole("dialog", { name: "Your shopping bag" }).waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: "Review order", exact: true }).waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: "Review order", exact: true }).click({ force: true });
  await page.getByText(/No payment is taken/).waitFor({ state: "visible", timeout: 5000 });
  await page.getByLabel("Name", { exact: true }).fill("Test Buyer");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page.getByRole("button", { name: "Save design", exact: true }).click({ force: true });
  await page.getByText(/No payment is taken in this concept store/).waitFor({ state: "visible", timeout: 5000 });

  await page.getByRole("button", { name: "Back to customising", exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Discover", exact: true }).click({ force: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.getByText("AF1 STUDIO", { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (dimensions.document > dimensions.viewport + 1) {
    throw new Error(`Mobile page overflows horizontally: ${dimensions.document}px > ${dimensions.viewport}px`);
  }

  if (failures.length) throw new Error(`Browser errors: ${failures.join(" | ")}`);
  console.log("PASS: 3D scene loaded; customiser labels and finish selection work; add-to-bag and concept checkout work; mobile layout has no horizontal overflow.");
} finally {
  await browser.close();
}
