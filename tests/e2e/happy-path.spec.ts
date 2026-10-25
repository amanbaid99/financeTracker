// Sign-in and goal tracking happy path against the LOCAL Supabase stack.
// Signs in with the real email code read from the local mail catcher (Mailpit).
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const email = `e2e-${Date.now()}@example.test`;

async function emailText(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const json = (await res.json()) as { messages?: { ID: string }[] };
    const id = json.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string; HTML: string };
      return msg.Text + msg.HTML;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("No sign-in email arrived");
}

async function signInCode(to: string): Promise<string> {
  const code = (await emailText(to)).match(/\b(\d{6,10})\b/)?.[1];
  if (!code) throw new Error("No code in the sign-in email");
  return code;
}

test.beforeAll(async () => {
  const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } });
  const { error } = await admin.from("allowed_emails").insert({ email });
  if (error) throw error;
});

test("invite-only sign in and goal tracking", async ({ page }) => {
  // Home Screen app: manifest and icons are public, and the login page links them.
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons.length).toBeGreaterThan(0);
  expect((await page.request.get("/icon-192.png")).ok()).toBe(true);

  // Not invited: friendly error.
  await page.goto("/login");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.getByText("Use Tracker like an app")).toBeVisible();
  await page.getByRole("checkbox", { name: /privacy policy/ }).check();
  await page.getByLabel("Email", { exact: true }).fill(`nobody-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText("isn't on the invite list")).toBeVisible();

  // Invited: wrong code is rejected, right code signs in.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  const code = await signInCode(email);
  await page.getByLabel("Code from the email", { exact: true }).fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("wrong or has expired")).toBeVisible();
  await page.getByLabel("Code from the email", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/goals$/);
  // The session is stored in long-lived, server-set cookies (not capped at 7 days).
  const authCookies = (await page.context().cookies()).filter((c) => c.name.includes("auth-token"));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const c of authCookies) expect(c.expires * 1000 - Date.now()).toBeGreaterThan(300 * 86_400_000);

  // Empty state, then a first goal.
  await expect(page.getByText("Start with a goal")).toBeVisible();
  await page.getByRole("button", { name: "Create a goal" }).click();
  await page.getByLabel("Goal name").fill("House");
  await page.getByLabel("Target amount").fill("2000000");
  await page.getByLabel("Target date").fill("2031-10-25");
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(page.getByRole("heading", { name: "House" })).toBeVisible();
  await expect(page.getByText("No investments yet")).toBeVisible();

  // A mutual fund, 60% for this goal, with the return filled from its category.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("flexi_cap");
  await expect(page.getByText("Leave blank to use 11.5% for this type.")).toBeVisible();
  await page.getByLabel("Nickname (optional)").fill("Index SIP");
  await page.getByLabel("Current value").fill("300000");
  await page.getByLabel("Monthly SIP").fill("10000");
  await page.getByLabel("Share for this goal, %").fill("60");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByRole("button", { name: "Edit Index SIP" })).toBeVisible();
  await expect(page.getByText("60% of it")).toBeVisible();

  // An FD as well.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Type").selectOption("fd");
  await page.getByLabel("Nickname (optional)").fill("Bank FD");
  await page.getByLabel("Current value").fill("100000");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByText("₹2,80,000", { exact: true })).toBeVisible();
  await expect(page.getByText(/you'll have about/)).toBeVisible();

  // A second goal with no date, sharing the rest of the fund.
  await page.getByRole("button", { name: "New goal" }).click();
  await page.getByLabel("Goal name").fill("Car");
  await page.getByLabel("Target amount").fill("500000");
  await page.getByLabel(/No fixed date/).check();
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(page.getByRole("heading", { name: "Car" })).toBeVisible();
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await page.getByRole("radio", { name: "One I already have" }).click();
  await expect(page.getByLabel("Share for this goal, %")).toHaveValue("40");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByText("40% of it")).toBeVisible();
  await expect(page.getByText(/you'll get there in about/)).toBeVisible();
  await expect(page.getByText("On its way")).toBeVisible();

  // Update the fund's value once; both goals follow.
  await page.getByRole("button", { name: "Edit Index SIP" }).first().click();
  await page.getByLabel("Current value").fill("400000");
  await expect(page.getByText(/also counts toward another goal/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("₹3,40,000", { exact: true })).toBeVisible();
  await expect(page.getByText("₹1,60,000", { exact: true }).first()).toBeVisible();

  // Can't give a goal more than the free share.
  await page.getByRole("button", { name: "Edit Index SIP" }).last().click();
  await page.getByLabel("Share for this goal, %").fill("50");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Only 40% of this investment is free")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  // Inflation on the House goal.
  await page.getByRole("button", { name: "Edit goal House" }).click();
  await page.getByLabel("Grow the target with inflation").check();
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText(/with 6% inflation/)).toBeVisible();

  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, "/goals overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/goals-375.png", fullPage: true });
  await page.getByRole("button", { name: "Add investment" }).first().click();
  await page.screenshot({ path: "test-results/goals-sheet-375.png" });
  await page.getByRole("button", { name: "Close" }).click();

  // Take the FD off the goal, then delete it from the unlinked list.
  await page.getByRole("button", { name: "Edit Bank FD" }).click();
  await page.getByRole("button", { name: "Remove from goal" }).click();
  await expect(page.getByText("Not linked to a goal")).toBeVisible();
  await page.getByRole("button", { name: "Edit Bank FD" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Tap again to delete" }).click();
  await expect(page.getByText("Not linked to a goal")).toHaveCount(0);

  // Deleting a goal keeps its investments.
  await page.getByRole("button", { name: "Edit goal Car" }).click();
  await page.getByRole("button", { name: "Delete goal" }).click();
  await page.getByRole("button", { name: "Tap again to delete" }).click();
  await expect(page.getByRole("heading", { name: "Car" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Index SIP" })).toHaveCount(1);

  // Theme from Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Beige" }).click();
  await page.getByRole("button", { name: "Save look" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "beige");
});
