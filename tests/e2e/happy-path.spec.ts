// Onboarding and dashboard happy path against the LOCAL Supabase stack.
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

test("invite-only sign in, onboarding and Next Focus", async ({ page }) => {
  // Not invited: friendly error.
  await page.goto("/login");
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
  await expect(page).toHaveURL(/\/onboarding\/basics/);

  // Basics + theme.
  await page.getByLabel("Your name", { exact: true }).fill("Asha");
  await page.getByLabel("Age", { exact: true }).fill("30");
  await page.getByLabel("City type", { exact: true }).selectOption("metro");
  await page.getByRole("radio", { name: "Beige" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/household/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "beige");

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/income/);
  await page.getByLabel("Monthly amount", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/expenses/);
  await page.getByLabel("Rent per month", { exact: true }).fill("40000");
  // Typing a custom cost name key by key keeps focus in the field.
  await page.getByRole("button", { name: "Add a cost" }).click();
  await page.getByLabel("Expense name", { exact: true }).pressSequentially("School fees");
  await expect(page.getByLabel("Expense name", { exact: true })).toHaveValue("School fees");
  await page.getByLabel("School fees per month", { exact: true }).pressSequentially("5000");
  await expect(page.getByLabel("School fees per month", { exact: true })).toHaveValue("5,000");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/insurance/);
  // A health policy for parents, paid monthly: budgeted, but not your own cover.
  await page.getByRole("button", { name: "Policy for parents / family" }).click();
  await expect(page.getByLabel("Who it covers", { exact: true })).toHaveValue("others");
  await page.getByLabel("Cover amount", { exact: true }).fill("500000");
  await page.getByLabel("Premium you pay", { exact: true }).fill("2000");
  await page.getByLabel("Paid", { exact: true }).selectOption("monthly");
  await expect(page.getByText("About ₹2,000 a month in your budget.")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/liabilities/);
  await page.getByLabel("No loans or card dues", { exact: true }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/holdings/);
  await page.getByLabel("Current value", { exact: true }).fill("20000");
  await page.getByLabel("Monthly SIP or deposit", { exact: true }).fill("5000");
  await page.getByLabel("Yearly step-up (%)", { exact: true }).fill("10");
  await expect(page.getByText("Next year: ₹5,500/month")).toBeVisible();
  // Return is pre-filled from the category; a new goal can be created inline.
  await expect(page.getByLabel("Expected return (% a year)", { exact: true })).toHaveValue("3");
  await page.getByLabel("Goal for this money", { exact: true }).selectOption("new");
  await page.getByLabel("Goal name", { exact: true }).fill("Bike");
  await page.getByLabel("Target amount (today's ₹)", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/goals/);
  await expect(page.getByText("Bike")).toBeVisible();
  await page.getByRole("button", { name: "Add retirement goal" }).click();
  await expect(page.getByText("Retirement").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/risk/);
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(page).toHaveURL(/finish/);
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page.getByRole("button", { name: "Show my next focus" }).click();

  // Dashboard: starter buffer is next. Essentials are 47k (40k rent + 5k school
  // fees + 2k parents' premium). The 20k savings is earmarked for the Bike goal,
  // so none of it counts toward the buffer.
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: "Build a 1-month starter buffer" })).toBeVisible();
  await expect(page.getByText("₹47,000").first()).toBeVisible();
  await expect(page.getByText("not investment advice", { exact: false }).first()).toBeVisible();

  // Usable at 375px: no horizontal scroll.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/dashboard-375.png", fullPage: true });

  // Other pages render.
  for (const [path, heading] of [
    ["/budget", "Budget"],
    ["/goals", "Goals"],
    ["/holdings", "Holdings"],
    ["/settings", "Settings"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o, `${path} overflows at 375px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results${path}-375.png`, fullPage: true });
  }
});
