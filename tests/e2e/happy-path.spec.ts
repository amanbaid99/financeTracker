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

  // Empty state, then a first goal picked by type.
  await expect(page.getByText("What are you saving for?")).toBeVisible();
  await page.getByRole("link", { name: "Add your first goal" }).click();
  await expect(page).toHaveURL(/\/goals\/new$/);
  await page.screenshot({ path: "test-results/goal-types-375.png", fullPage: true });
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("House");
  await page.getByLabel("How much do you need?").fill("2000000");
  await page.getByLabel("By when?").fill("2031-10-25");
  await page.getByLabel(/grow the target with inflation/).uncheck();
  await page.getByRole("button", { name: "Create goal" }).click();
  // Back on the list with the new goal expanded.
  await expect(page).toHaveURL(/\/goals\?open=/);
  await expect(page.getByRole("button", { name: /^House/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/^Nothing yet/)).toBeVisible();

  // A mutual fund, 60% for this goal.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("flexi_cap");
  await page.getByLabel("Nickname (optional)").fill("Index SIP");
  await page.getByLabel("Value today").fill("300000");
  await page.getByLabel("Monthly SIP").fill("10000");
  await page.getByText(/^More options/).click();
  await expect(page.getByLabel("Expected return, % a year")).toHaveAttribute("placeholder", "11.5");
  await page.getByLabel("Share for this goal, %").fill("60");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByRole("button", { name: "Edit Index SIP" })).toBeVisible();
  await expect(page.getByText("60% of it")).toBeVisible();

  // An FD as well.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Type").selectOption("fd");
  await page.getByLabel("Nickname (optional)").fill("Bank FD");
  await page.getByLabel("Value today").fill("100000");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByText("₹2,80,000", { exact: true })).toBeVisible();
  await expect(page.getByText("Needed each month to be on time")).toBeVisible();
  await expect(page.getByText(/^Needs ₹[\d,]+ more a month$/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/goal-house-375.png", fullPage: true });

  // A loan payoff goal: the EMI splits into interest and principal as you type.
  await page.getByRole("link", { name: "New goal" }).click();
  await page.getByRole("button", { name: /^Pay off a loan/ }).click();
  // From the original loan: today's balance is worked out from EMIs paid.
  await page.getByRole("radio", { name: "Work it out from my loan" }).click();
  await page.getByLabel("Original loan amount").fill("1000000");
  const first = new Date();
  first.setMonth(first.getMonth() - 10);
  first.setDate(1);
  await page.getByLabel("First EMI date").fill(first.toISOString().slice(0, 10));
  await page.getByLabel("Interest, % a year").fill("8.65");
  await expect(page.getByLabel("Interest, % a year")).toHaveValue("8.65");
  await page.getByLabel("Tenure, months").fill("120");
  await expect(page.getByText(/^1[01] EMIs paid so far\. Owed today:/)).toBeVisible();
  await expect(page.getByText(/^Next EMI on /)).toBeVisible();
  await page.screenshot({ path: "test-results/loan-form-375.png", fullPage: true });

  // What's owed now, with the EMI date.
  await page.getByRole("radio", { name: "I know what I owe now" }).click();
  await page.getByLabel("Owed after your latest EMI").fill("1000000");
  await page.getByLabel("EMI date").selectOption("5");
  await page.getByLabel("EMI", { exact: true }).fill("12668");
  await page.getByLabel("Interest, % a year").fill("9");
  await expect(page.getByText("₹7,500 interest")).toBeVisible();
  await expect(page.getByText("₹5,168 principal")).toBeVisible();
  await expect(page.getByText(/\(120 EMIs\)/)).toBeVisible();
  await page.getByLabel("Foreclosure charge, % of amount owed").fill("4");
  await expect(page.getByLabel("Plus 18% GST on the charge")).toBeChecked();
  await expect(page.getByText(/Closing today would cost ₹10,47,200, including ₹47,200 in foreclosure charges/)).toBeVisible();
  await page.getByLabel(/No date: tell me when I can close it/).check();
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(page.getByRole("button", { name: /^Close my loan/ })).toHaveAttribute("aria-expanded", "true");
  // Only one goal open at a time; dated goals sort before goals with no date.
  await expect(page.getByRole("button", { name: /^House/ })).toHaveAttribute("aria-expanded", "false");
  const order = await page.locator("main li > button[aria-expanded]").allInnerTexts();
  expect(order[0]).toMatch(/^House/);
  expect(order[1]).toMatch(/^Close my loan/);
  await expect(page.getByText("Owed today", { exact: true })).toBeVisible();
  await expect(page.getByText("This month: principal")).toBeVisible();
  await expect(page.getByText("₹5,168", { exact: true })).toBeVisible();

  // Link the rest of the fund to the loan goal.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByRole("radio", { name: "One I already have" }).click();
  await expect(page.getByLabel("Share for this goal, %")).toHaveValue("40");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByText("40% of it")).toBeVisible();
  await expect(page.getByText(/your savings catch up with the cost of closing it/)).toBeVisible();
  await expect(page.getByText(/4% \+ GST · ₹47,200 today/)).toBeVisible();
  await expect(page.getByText(/in foreclosure charges:/)).toBeVisible();
  await expect(page.getByText(/^Can close it around/)).toBeVisible();
  let o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, "loan goal overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/goal-loan-375.png", fullPage: true });

  // Update the fund once from here; the House goal follows.
  await page.getByRole("button", { name: "Edit Index SIP" }).click();
  await page.getByLabel("Value today").fill("400000");
  await expect(page.getByText(/also counts toward another goal/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(page.getByText("₹3,40,000", { exact: true })).toBeVisible();

  // Can't give a goal more than the free share.
  await page.getByRole("button", { name: "Edit Index SIP" }).click();
  await page.getByLabel("Share for this goal, %").fill("70");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Only 60% of this investment is free")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // Turn on inflation for the House goal.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel(/grow the target with inflation/).check();
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText(/grown at 6% a year/)).toBeVisible();

  // Update amounts for everything in one go.
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByText("Type in what each investment is worth today.")).toBeVisible();
  await page.getByLabel("Bank FD value today").fill("120000");
  await expect(page.getByText("Was ₹1,00,000")).toBeVisible();
  await page.screenshot({ path: "test-results/update-375.png" });
  await page.getByRole("button", { name: "Save 1 change" }).click();
  await expect(page.getByText("₹3,60,000", { exact: true })).toBeVisible();

  // Take the FD off the goal, then delete it from there.
  await page.getByRole("button", { name: "Edit Bank FD" }).click();
  await page.getByRole("button", { name: "Remove from goal" }).click();
  await expect(page.getByRole("button", { name: "Edit Bank FD" })).toHaveCount(0);
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(page.getByRole("button", { name: /^House/ })).toHaveAttribute("aria-expanded", "false");
  o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, "/goals overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/goals-375.png", fullPage: true });
  await expect(page.getByText(/not linked to a goal/)).toHaveCount(0);

  // Deleting a goal keeps its investments.
  await page.getByRole("button", { name: /^Close my loan/ }).click();
  await page.getByRole("button", { name: "Delete goal" }).click();
  await page.getByRole("button", { name: "Tap again to delete this goal" }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole("button", { name: /^Close my loan/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(page.getByRole("button", { name: "Edit Index SIP" })).toBeVisible();

  // Money plan: suggests a split, and recording it takes it out of the plan.
  await page.getByRole("button", { name: /Plan my money/ }).click();
  await expect(page.getByText(/in investments not linked to a goal/)).toBeVisible();
  await page.getByRole("button", { name: "Use this amount" }).click();
  await expect(page.getByLabel("Savings to put toward goals now")).toHaveValue("2,80,000");
  await page.getByLabel("Can invest each month, in total").fill("40000");
  await page.getByRole("button", { name: "Suggest a split" }).click();
  await expect(page.getByText("Your money plan")).toBeVisible();
  await expect(page.getByText("₹2,80,000 now · ₹30,000 a month free (after ₹10,000 of SIPs)")).toBeVisible();
  await expect(page.getByText("Suggested", { exact: true })).toBeVisible();
  await expect(page.getByText(/into an equity index fund/)).toBeVisible();
  await page.screenshot({ path: "test-results/plan-375.png", fullPage: true });
  await page.getByRole("button", { name: "I've invested this" }).click();
  await expect(page.getByText("Filled in from your plan.")).toBeVisible();
  await expect(page.getByLabel("Fund category")).toHaveValue("equity_index");
  await page.getByLabel("Nickname (optional)").fill("Planned index fund");
  await page.getByRole("dialog").getByRole("button", { name: "Add investment" }).click();
  await expect(page.getByRole("button", { name: "Edit Planned index fund" })).toBeVisible();
  await expect(page.getByText(/^₹0 now · /)).toBeVisible();

  // Bills fund: one liquid fund for known payments.
  const inMonths = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    d.setDate(10);
    return d.toISOString().slice(0, 10);
  };
  await page.getByRole("link", { name: "New goal" }).click();
  await page.getByRole("button", { name: /^Bills fund/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Bills fund");
  await page.getByRole("button", { name: "+ Health insurance" }).click();
  await page.getByLabel("Health insurance amount").fill("24000");
  await page.getByLabel("Health insurance next due").fill(inMonths(4));
  await page.getByRole("button", { name: "+ Gym" }).click();
  await page.getByLabel("Gym amount").fill("12000");
  await page.getByLabel("Gym how often").selectOption("6");
  await page.getByLabel("Gym next due").fill(inMonths(1));
  await page.screenshot({ path: "test-results/bills-form-375.png", fullPage: true });
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(page.getByRole("button", { name: /^Bills fund/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Should hold today")).toBeVisible();
  await expect(page.getByText("Put in each month")).toBeVisible();
  await expect(page.getByText("₹4,000", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/short for Gym on/).first()).toBeVisible();

  // Link one liquid fund: payments show as covered.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("liquid_fund");
  await page.getByLabel("Nickname (optional)").fill("Bills liquid fund");
  await page.getByLabel("Value today").fill("30000");
  await page.getByLabel("Monthly SIP").fill("5000");
  await page.getByRole("dialog").getByRole("button", { name: "Add investment" }).click();
  await expect(page.getByText(/^Next: Gym on .+, covered$/)).toBeVisible();
  await expect(page.getByText("Covered", { exact: true }).first()).toBeVisible();
  o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, "bills fund overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/bills-fund-375.png", fullPage: true });

  // Theme from Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Beige" }).click();
  await page.getByRole("button", { name: "Save look" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "beige");
});
