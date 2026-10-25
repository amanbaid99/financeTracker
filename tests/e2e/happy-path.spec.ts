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
  await expect(page).toHaveURL(/\/onboarding\/basics/);
  // The session is stored in long-lived, server-set cookies (not capped at 7 days).
  const authCookies = (await page.context().cookies()).filter((c) => c.name.includes("auth-token"));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const c of authCookies) expect(c.expires * 1000 - Date.now()).toBeGreaterThan(300 * 86_400_000);

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
  await page.getByLabel("Debit day", { exact: true }).selectOption("7");
  await expect(page.getByLabel("Count this in my monthly budget")).toBeChecked();
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
    ["/details", "My details"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o, `${path} overflows at 375px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results${path}-375.png`, fullPage: true });
  }

  // Editing a section from My details saves and comes back.
  await page.goto("/details");
  await page.getByRole("link", { name: /Loans and cards/ }).click();
  await expect(page).toHaveURL(/\/details\/liabilities/);
  await page.getByLabel("No loans or card dues", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Add a loan or card" }).click();
  await page.getByLabel("Amount still owed", { exact: true }).fill("30000");
  await page.getByLabel("Interest rate (% a year)", { exact: true }).fill("36");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/details$/);
  await expect(page.getByText("₹30,000 owed")).toBeVisible();

  // Credit card paid in full, a planned expense, then This month.
  await page.goto("/details/cards");
  await page.getByLabel("Card nickname", { exact: true }).fill("Travel card");
  await page.getByLabel("Total outstanding now", { exact: true }).fill("15000");
  await page.getByLabel("Payment due day", { exact: true }).selectOption("28");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/details$/);

  await page.goto("/details/planned");
  await page.getByRole("button", { name: "Gym membership" }).click();
  await page.getByLabel("Amount each time", { exact: true }).fill("12000");
  await page.getByLabel("Next due", { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await expect(page.getByText("Save for it monthly: ₹1,000 a month")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/details$/);

  await page.goto("/month");
  await expect(page.getByText("Travel card bill")).toBeVisible();
  await expect(page.getByText("Gym membership")).toBeVisible();
  // A bill that isn't generated yet, then its amount once it arrives.
  await page.getByRole("button", { name: "Add a bill" }).click();
  await page.getByLabel("Bill", { exact: true }).fill("Electricity");
  await page.getByLabel("Due day", { exact: true }).selectOption("28");
  await page.getByRole("button", { name: "Add bill", exact: true }).click();
  await expect(page.getByText("Electricity")).toBeVisible();
  await expect(page.getByText(/^Not generated yet/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add amount" }).first().click();
  await page.getByLabel("Electricity amount").fill("2100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("₹2,100")).toBeVisible();
  await page.getByLabel("Mark Travel card bill as paid").check();
  await page.reload();
  await expect(page.getByLabel("Mark Travel card bill as paid")).toBeChecked();

  await page.getByRole("tab", { name: "Bank & dues" }).click();
  // The card bill was ticked as paid, so it's no longer deducted.
  await expect(page.getByText("Card bills still to pay")).toBeVisible();
  await page.getByRole("button", { name: "Add bank account" }).click();
  await page.getByLabel("Account nickname").fill("Salary account");
  await page.getByLabel("Current balance").fill("80000");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByLabel("Salary account balance")).toHaveValue("80,000");
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, "/month overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/month-bank-375.png", fullPage: true });
  await page.goto("/month");
  await page.screenshot({ path: "test-results/month-bills-375.png", fullPage: true });

  // A goal with no deadline gets an estimated date.
  await page.goto("/goals/new");
  await page.getByLabel("Goal type", { exact: true }).selectOption("travel");
  await page.getByLabel("Name", { exact: true }).fill("Japan trip");
  await page.getByLabel("Target in today's rupees", { exact: true }).fill("100000");
  await page.getByLabel("No fixed date: tell me when I'll get there").check();
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByRole("heading", { name: "Japan trip" })).toBeVisible();
  await expect(page.getByText("No deadline", { exact: true })).toBeVisible();
  await expect(page.getByText("Get there in")).toBeVisible();

  // Budget ratios: savings minimum 25% is saved and used.
  await page.goto("/budget");
  await page.getByLabel("Save at least", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Save ratios" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Save at least", { exact: true })).toHaveValue("25");
  await expect(page.getByText("at least 25%")).toBeVisible();

  // Term cover target of 2 Cr in Settings, without losing the ratio above.
  await page.goto("/settings");
  await page.getByLabel("My term cover target (₹)", { exact: true }).fill("20000000");
  await page.getByRole("button", { name: "Save assumptions" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("My term cover target (₹)", { exact: true })).toHaveValue("2,00,00,000");
  await page.goto("/budget");
  await expect(page.getByLabel("Save at least", { exact: true })).toHaveValue("25");
  await page.screenshot({ path: "test-results/budget-ratios-375.png", fullPage: true });

  // Money plan on the Budget page.
  await page.goto("/budget");
  await expect(page.getByText("Your money plan this month")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Essentials/ })).toBeVisible();
  // The 30k card debt added earlier gets a snowball payoff plan.
  await expect(page.getByText("Debt payoff plan")).toBeVisible();
  await expect(page.getByText(/Snowball method/)).toBeVisible();
  await page.screenshot({ path: "test-results/money-plan-375.png", fullPage: true });

  // Salary 0: between-incomes mode with runway.
  await page.goto("/details/income");
  await page.getByLabel("Monthly amount", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/details$/);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "You're between incomes" })).toBeVisible();
  await expect(page.getByText("Savings last")).toBeVisible();
  await page.goto("/budget");
  await expect(page.getByText(/No income right now/).first()).toBeVisible();

  // Salary back: normal plan returns.
  await page.goto("/details/income");
  await page.getByLabel("Monthly amount", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/details$/);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "You're between incomes" })).toHaveCount(0);

  // Quick update: change a bank balance and a loan in one save.
  await page.getByRole("link", { name: "Update", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quick update" })).toBeVisible();
  await page.getByLabel("Salary account balance today").fill("90000");
  await page.getByLabel(/Credit card debt.*amount still owed/).fill("25000");
  await expect(page.getByText("2 changes not saved yet")).toBeVisible();
  await page.getByRole("button", { name: "Save all" }).click();
  await expect(page.getByText("Saved 2 updates.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Salary account balance today")).toHaveValue("90,000");
  await expect(page.getByLabel(/Credit card debt.*amount still owed/)).toHaveValue("25,000");
  const updateOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(updateOverflow, "/update overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/update-375.png", fullPage: false });
  await page.goto("/dashboard");
  await expect(page.getByText("Balances updated today")).toBeVisible();

  // Holdings: add one with a goal, edit it, then remove it.
  await page.goto("/holdings");
  await expect(page.getByText("Where your money is")).toBeVisible();
  await page.getByRole("link", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Mutual fund", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Index fund");
  await page.getByLabel("Fund category", { exact: true }).selectOption({ label: "Equity index fund" });
  await page.getByLabel("Current value", { exact: true }).fill("50000");
  await page.getByLabel("Monthly SIP / deposit", { exact: true }).fill("5000");
  await page.getByLabel("What's it for?", { exact: true }).selectOption({ label: "Bike" });
  await page.getByRole("button", { name: "Add holding" }).click();
  await expect(page).toHaveURL(/\/holdings$/);
  await expect(page.getByRole("heading", { name: "Mutual funds" })).toBeVisible();
  const row = page.getByRole("link", { name: /Index fund/ });
  await expect(row).toContainText("Bike");
  await expect(row).toContainText("Equity index fund");
  await page.screenshot({ path: "test-results/holdings-list-375.png", fullPage: true });
  await row.click();
  await page.getByLabel("Current value", { exact: true }).fill("55000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/holdings$/);
  await expect(page.getByRole("link", { name: /Index fund/ })).toContainText("₹55,000");
  await page.getByRole("link", { name: /Index fund/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove holding" }).click();
  await expect(page).toHaveURL(/\/holdings$/);
  await expect(page.getByRole("link", { name: /Index fund/ })).toHaveCount(0);
});
