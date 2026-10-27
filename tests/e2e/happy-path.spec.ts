// Sign-in and goal tracking happy path against the LOCAL Supabase stack.
// Signs in with the real email code read from the local mail catcher (Mailpit).
import { createClient } from "@supabase/supabase-js";
import { GUIDES } from "../../lib/guides";
import { expect, test } from "@playwright/test";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const email = `e2e-${Date.now()}@example.test`;

async function emailText(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const json = (await res.json()) as { messages?: { ID: string }[] };
    const id = json.messages?.[0]?.ID;
    if (id) {
      const msg = (await (
        await fetch(`${MAILPIT}/api/v1/message/${id}`)
      ).json()) as { Text: string; HTML: string };
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
  const admin = createClient(SUPABASE_URL, SECRET, {
    auth: { persistSession: false },
  });
  const { error } = await admin.from("allowed_emails").insert({ email });
  if (error) throw error;
});

const GUIDE_TITLES = new RegExp(
  `^(${Object.values(GUIDES)
    .map((g) => g.title)
    .join("|")})$`,
);

test("invite-only sign in and goal tracking", async ({ page }) => {
  // The bottom tab bar, and the + menu for adding and updating.
  const tab = (name: string) =>
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });
  const quick = async (name: string) => {
    await page.getByRole("button", { name: "Add or update" }).click();
    await page.getByRole("link", { name }).click();
  };
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
  await page
    .getByLabel("Email", { exact: true })
    .fill(`nobody-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText("isn't on the invite list")).toBeVisible();

  // Invited: wrong code is rejected, right code signs in.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  const code = await signInCode(email);
  await page
    .getByLabel("Code from the email", { exact: true })
    .fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("wrong or has expired")).toBeVisible();
  await page.getByLabel("Code from the email", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/goals$/);
  // First visit: the Goals guide pops up once, and (i) brings it back.
  // A new user gets no "What's new".
  const goalsGuide = page.getByRole("dialog", { name: "How goals work" });
  await expect(goalsGuide).toBeVisible();
  await expect(page.getByRole("dialog", { name: "What's new" })).toHaveCount(0);
  const savedSeen = page.waitForResponse((r) => r.request().method() === "POST");
  await goalsGuide.getByRole("button", { name: "Got it" }).click();
  await savedSeen;
  await expect(goalsGuide).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("What are you saving for?")).toBeVisible();
  await expect(goalsGuide).toHaveCount(0);
  await page.getByRole("button", { name: "Guide: How goals work" }).click();
  await expect(goalsGuide).toBeVisible();
  await goalsGuide.getByRole("button", { name: "Got it" }).click();
  // Other sections' guides pop up on first visit; close them as they come.
  const sectionGuide = page.getByRole("dialog", { name: GUIDE_TITLES });
  const closeGuides = async () =>
    page.addLocatorHandler(sectionGuide, async (d) => {
      await d.getByRole("button", { name: "Got it" }).click();
    });
  await closeGuides();
  // Old pages a Home Screen app may still open go to Goals.
  for (const old of [
    "/dashboard",
    "/month",
    "/holdings/new",
    "/budget/build",
    "/update",
  ]) {
    await page.goto(old);
    await expect(page).toHaveURL(/\/goals$/);
  }
  // The session is stored in long-lived, server-set cookies (not capped at 7 days).
  const authCookies = (await page.context().cookies()).filter((c) =>
    c.name.includes("auth-token"),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  for (const c of authCookies)
    expect(c.expires * 1000 - Date.now()).toBeGreaterThan(300 * 86_400_000);

  // Empty state, then a first goal picked by type.
  await expect(page.getByText("What are you saving for?")).toBeVisible();
  await page.getByRole("link", { name: "Add your first goal" }).click();
  await expect(page).toHaveURL(/\/goals\/new$/);
  await page.screenshot({
    path: "test-results/goal-types-375.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("House");
  await page.getByLabel("How much do you need?").fill("2000000");
  // Exactly five years out, so the plan suggests an equity index fund.
  const inFiveYears = new Date(Date.now() + 5.5 * 3_600_000);
  inFiveYears.setUTCFullYear(inFiveYears.getUTCFullYear() + 5);
  await page
    .getByLabel("By when?")
    .fill(inFiveYears.toISOString().slice(0, 10));
  await page.getByLabel(/grow the target with inflation/).uncheck();
  await page.getByRole("button", { name: "Create goal" }).click();
  // Back on the list with the new goal expanded.
  await expect(page).toHaveURL(/\/goals\?open=/);
  await expect(page.getByRole("button", { name: /^House/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  // Nothing linked yet: a suggestion for what to save it in.
  await expect(page.getByText("How to save for it")).toBeVisible();
  await expect(
    page.getByText(/SIP in an equity index fund \(5\+ years away/),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/fund-suggest-375.png" });
  await page.getByRole("button", { name: "Add it" }).click();
  await expect(
    page.getByText("Filled in from the suggestion."),
  ).toBeVisible();
  await expect(page.getByLabel("Fund category")).toHaveValue("equity_index");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // A mutual fund, 60% for this goal.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("flexi_cap");
  await page.getByLabel("Nickname (optional)").fill("Index SIP");
  await page.getByLabel("Value today").fill("300000");
  await page.getByLabel("Monthly SIP").fill("10000");
  await page.getByText(/^More options/).click();
  await expect(page.getByLabel("Expected return, % a year")).toHaveAttribute(
    "placeholder",
    "11.5",
  );
  await page.getByLabel("Share for this goal, %").fill("60");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(
    page.getByRole("button", { name: "Edit Index SIP" }),
  ).toBeVisible();
  await expect(page.getByText("60% of it")).toBeVisible();

  // An FD as well.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Type").selectOption("fd");
  await page.getByLabel("Nickname (optional)").fill("Bank FD");
  await page.getByLabel("Value today").fill("100000");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByText("₹2,80,000", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Put ₹[\d,]+ a month into it to be on time/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByText("Needed each month to be on time")).toBeVisible();
  await expect(
    page.getByText(/^Needs ₹[\d,]+ more a month$/).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/goal-house-375.png",
    fullPage: true,
  });

  // A loan payoff goal: the EMI splits into interest and principal as you type.
  await quick("New goal");
  await page.getByRole("button", { name: /^Pay off a loan/ }).click();
  // From the original loan: today's balance is worked out from EMIs paid.
  await page.getByRole("radio", { name: "Work it out from my loan" }).click();
  await page.getByLabel("Original loan amount").fill("1000000");
  const first = new Date();
  first.setMonth(first.getMonth() - 10);
  first.setDate(1);
  await page
    .getByLabel("First EMI date")
    .fill(first.toISOString().slice(0, 10));
  await page.getByLabel("Interest, % a year").fill("8.65");
  await expect(page.getByLabel("Interest, % a year")).toHaveValue("8.65");
  await page.getByLabel("Tenure, months").fill("120");
  await expect(
    page.getByText(/^1[01] EMIs paid so far\. Owed today:/),
  ).toBeVisible();
  await expect(page.getByText(/^Next EMI on /)).toBeVisible();
  await page.screenshot({
    path: "test-results/loan-form-375.png",
    fullPage: true,
  });

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
  await expect(
    page.getByText(
      /Closing today would cost ₹10,47,200, including ₹47,200 in foreclosure charges/,
    ),
  ).toBeVisible();
  await page.getByLabel(/No date: tell me when I can close it/).check();
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(
    page.getByRole("button", { name: /^Close my loan/ }),
  ).toHaveAttribute("aria-expanded", "true");
  // Only one goal open at a time; dated goals sort before goals with no date.
  await expect(page.getByRole("button", { name: /^House/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  const order = await page
    .locator("main li > button[aria-expanded]")
    .allInnerTexts();
  expect(order[0]).toMatch(/^House/);
  expect(order[1]).toMatch(/^Close my loan/);
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(page.getByText("Owed today", { exact: true })).toBeVisible();
  await expect(page.getByText("This month: principal")).toBeVisible();
  await expect(page.getByText("₹5,168", { exact: true })).toBeVisible();

  // Link the rest of the fund to the loan goal.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByRole("radio", { name: "One I already have" }).click();
  await expect(page.getByLabel("Share for this goal, %")).toHaveValue("40");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(page.getByText("40% of it")).toBeVisible();
  await expect(
    page.getByText(/your savings catch up with the cost of closing it/),
  ).toBeVisible();
  await expect(page.getByText(/4% \+ GST · ₹47,200 today/)).toBeVisible();
  await expect(page.getByText(/in foreclosure charges:/)).toBeVisible();
  await expect(page.getByText(/^Can close it around/)).toBeVisible();
  let o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "loan goal overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/goal-loan-375.png",
    fullPage: true,
  });

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
  await expect(
    page.getByText("Only 60% of this investment is free"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // Turn on inflation for the House goal.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel(/grow the target with inflation/).check();
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText(/grown at 6% a year/)).toBeVisible();

  // Update amounts for everything in one go.
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    page.getByText("Type in what each investment is worth today."),
  ).toBeVisible();
  await page.getByLabel("Bank FD value today").fill("120000");
  await expect(page.getByText("Was ₹1,00,000")).toBeVisible();
  await page.screenshot({ path: "test-results/update-375.png" });
  await page.getByRole("button", { name: "Save 1 change" }).click();
  await expect(page.getByText("₹3,60,000", { exact: true })).toBeVisible();

  // Take the FD off the goal, then delete it from there.
  await page.getByRole("button", { name: "Edit Bank FD" }).click();
  await page.getByRole("button", { name: "Remove from goal" }).click();
  await expect(page.getByRole("button", { name: "Edit Bank FD" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(page.getByRole("button", { name: /^House/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "/goals overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/goals-375.png", fullPage: true });
  await expect(page.getByText(/not linked to a goal/)).toHaveCount(0);

  // Deleting a goal keeps its investments.
  await page.getByRole("button", { name: /^Close my loan/ }).click();
  await page.getByRole("button", { name: "Show details" }).click();
  await page.getByRole("button", { name: "Delete goal" }).click();
  await page
    .getByRole("button", { name: "Tap again to delete this goal" })
    .click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(
    page.getByRole("button", { name: /^Close my loan/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^House/ }).click();
  await expect(
    page.getByRole("button", { name: "Edit Index SIP" }),
  ).toBeVisible();

  // Money plan: suggests a split, and recording it takes it out of the plan.
  await quick("Plan my money");
  await expect(
    page.getByText(/in investments not linked to a goal/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use this amount" }).click();
  await expect(page.getByLabel("Savings to put toward goals now")).toHaveValue(
    "2,80,000",
  );
  await page.getByLabel("Can invest each month, in total").fill("40000");
  await page.getByRole("button", { name: "Suggest a split" }).click();
  await expect(page.getByText("Your money plan")).toBeVisible();
  await expect(
    page.getByText(
      "₹2,80,000 now · ₹30,000 a month free (after ₹10,000 of SIPs)",
    ),
  ).toBeVisible();
  await expect(page.getByText("Suggested", { exact: true })).toBeVisible();
  await expect(page.getByText(/into an equity index fund/)).toBeVisible();
  await page.screenshot({ path: "test-results/plan-375.png", fullPage: true });
  await page.getByRole("button", { name: "I've invested this" }).click();
  await expect(page.getByText("Filled in from your plan.")).toBeVisible();
  await expect(page.getByLabel("Fund category")).toHaveValue("equity_index");
  await page.getByLabel("Nickname (optional)").fill("Planned index fund");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add investment" })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Planned index fund" }),
  ).toBeVisible();
  await expect(page.getByText(/^₹0 now · /)).toBeVisible();

  // Bills fund: one liquid fund for known payments.
  const inMonths = (n: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    d.setDate(10);
    return d.toISOString().slice(0, 10);
  };
  await quick("New goal");
  await page.getByRole("button", { name: /^Bills fund/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Bills fund");
  await page.getByRole("button", { name: "+ Health insurance" }).click();
  await page.getByLabel("Health insurance amount").fill("24000");
  await page.getByLabel("Health insurance next due").fill(inMonths(4));
  await page.getByRole("button", { name: "+ Gym" }).click();
  await page.getByLabel("Gym amount").fill("12000");
  await page.getByLabel("Gym how often").selectOption("6");
  await page.getByLabel("Gym next due").fill(inMonths(1));
  await page.screenshot({
    path: "test-results/bills-form-375.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(
    page.getByRole("button", { name: /^Bills fund/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Show details" }).click();
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add investment" })
    .click();
  await expect(page.getByText(/^Next: Gym on .+, covered$/)).toBeVisible();
  await expect(
    page.getByText("Covered", { exact: true }).first(),
  ).toBeVisible();
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "bills fund overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/bills-fund-375.png",
    fullPage: true,
  });

  // Import a CAS statement: bad files are refused with a plain reason.
  const PP = "Parag Parikh Flexi Cap Fund - Direct Plan Growth";
  const LIQ = "Edelweiss Liquid Fund - Direct Growth";
  const MYST = "Quant Mystery Opportunities Fund - Direct Growth";
  await page.getByRole("link", { name: "Import CAS" }).click();
  await page.getByRole("button", { name: "How to get your statement" }).click();
  await expect(
    page.getByRole("heading", { name: "Getting your CAS" }),
  ).toBeVisible();
  await expect(page.getByText(/camsonline\.com/)).toBeVisible();
  await page.getByRole("tab", { name: "Stocks & demat" }).click();
  await expect(page.getByText(/cdslindia\.com/)).toBeVisible();
  await page.screenshot({ path: "test-results/cas-guide-375.png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Import a statement" }),
  ).toBeVisible();
  await page
    .getByLabel("Statement PDF")
    .setInputFiles({
      name: "notes.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("hello"),
    });
  await page.getByRole("button", { name: /Read statement/ }).click();
  await expect(page.getByText(/^This isn't a PDF\./)).toBeVisible();
  await page
    .getByLabel("Statement PDF")
    .setInputFiles("tests/e2e/fixtures/locked.pdf");
  await page.getByLabel("PDF password").fill("wrong");
  await page.getByRole("button", { name: /Read statement/ }).click();
  await expect(
    page.getByText("That password didn't open the statement."),
  ).toBeVisible();

  // The test statement: review, answer the questions, save.
  await page.getByLabel("PDF password").fill("fixture");
  await page.getByRole("button", { name: /Read statement/ }).click();
  await expect(page.getByText("CAMS statement · 30 Sep 2026")).toBeVisible();
  await expect(
    page.getByText(/^4 holdings read\. Every value checks out/),
  ).toBeVisible();
  await expect(page.getByText("What kind of fund is this?")).toBeVisible();
  await expect(page.getByLabel(`${MYST}: kind of fund`)).toHaveValue("");
  // Can't move on until every question is answered.
  await expect(
    page.getByRole("button", { name: "Answer 1 question to continue" }),
  ).toBeDisabled();
  await expect(page.getByLabel(`${PP}: kind of fund`)).toHaveValue("flexi_cap");
  await expect(page.getByLabel(`${LIQ}: monthly SIP`)).toHaveValue("5,000");
  await page
    .getByLabel(`${PP}: this is`)
    .selectOption({ label: "Update “Index SIP”" });
  await page
    .getByLabel(`${LIQ}: this is`)
    .selectOption({ label: "Update “Bills liquid fund”" });
  await page.getByLabel(`${MYST}: kind of fund`).selectOption("flexi_cap");
  await page.getByLabel(`${MYST}: goal`).selectOption({ label: "House" });
  await page.getByLabel("Stocks in demat: this is").selectOption("skip");
  // Answered questions clear, and a fund picked by hand shows its old value.
  await expect(page.getByText("What kind of fund is this?")).toHaveCount(0);
  await expect(page.getByText(/needs? a quick check/)).toHaveCount(0);
  await expect(page.getByText("was ₹4,00,000")).toBeVisible();
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "/import overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/import-review-375.png",
    fullPage: true,
  });
  // Nothing is saved until the changes are confirmed.
  await page.getByRole("button", { name: /Review changes/ }).click();
  await expect(page.getByText("Check before saving")).toBeVisible();
  await expect(page.getByRole("region", { name: "Will update" })).toContainText(
    "Index SIP",
  );
  await expect(page.getByRole("region", { name: "Will update" })).toContainText(
    "Value ₹4,00,000 → ₹4,20,000",
  );
  await expect(page.getByRole("region", { name: "Will add" })).toContainText(
    MYST,
  );
  await expect(page.getByRole("region", { name: "Will add" })).toContainText(
    "Counts toward House",
  );
  await expect(page.getByRole("region", { name: "Will skip" })).toContainText(
    "Stocks in demat",
  );
  await page.screenshot({
    path: "test-results/import-confirm-375.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByLabel(`${MYST}: kind of fund`)).toHaveValue(
    "flexi_cap",
  );
  await page.getByRole("button", { name: /Review changes/ }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(
    page.getByText("Updated 2 and added 1 investment."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to your goals" }).click();
  await page.getByRole("button", { name: /^Bills fund/ }).click();
  await expect(
    page.getByRole("button", { name: "Edit Bills liquid fund" }),
  ).toContainText("₹31,000");

  // Importing again matches every fund by its ISIN, with the category kept.
  await quick("Import statement");
  await page
    .getByLabel("Statement PDF")
    .setInputFiles("tests/e2e/fixtures/locked.pdf");
  await page.getByLabel("PDF password").fill("fixture");
  await page.getByRole("button", { name: /Read statement/ }).click();
  await expect(page.getByText("CAMS statement · 30 Sep 2026")).toBeVisible();
  for (const name of [PP, LIQ, MYST])
    await expect(page.getByLabel(`${name}: this is`)).not.toHaveValue("new");
  await expect(page.getByLabel(`${MYST}: kind of fund`)).toHaveValue(
    "flexi_cap",
  );
  await expect(page.getByText("What kind of fund is this?")).toHaveCount(0);
  await page.getByLabel("Stocks in demat: this is").selectOption("skip");
  await page.getByRole("button", { name: /Review changes/ }).click();
  await expect(
    page.getByRole("region", { name: "Already up to date" }),
  ).toContainText("Index SIP");
  await expect(
    page.getByRole("button", { name: "Confirm and save" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Go back" }).click();

  // Portfolio: everything held, split by asset class, with growth.
  await tab("Portfolio").click();
  await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();
  await expect(page.getByText("Where your money is")).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Where your money is" })
      .getByRole("button", { name: /^Equity:/ }),
  ).toBeVisible();
  await expect(page.getByText(/grown$/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Holdings" })).toContainText(
    "Index SIP",
  );
  await expect(page.getByRole("list", { name: "Holdings" })).toContainText(
    "+₹70,000 (+20%)",
  );
  await page
    .getByRole("group", { name: "Where your money is" })
    .getByRole("button", { name: /^Equity:/ })
    .click();
  await expect(page.getByText(/^Equity · ₹/)).toBeVisible();
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "/portfolio overflows at 375px").toBeLessThanOrEqual(0);
  // Edit, update or import right from Portfolio.
  await expect(page.getByRole("link", { name: "Import CAS" })).toHaveAttribute("href", "/import");
  await page.getByRole("button", { name: "Edit Index SIP" }).click();
  await expect(page.getByRole("dialog", { name: "Index SIP" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByText("Type in what each investment is worth today.")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add an investment or saving" })).toBeVisible();
  await page.screenshot({
    path: "test-results/portfolio-375.png",
    fullPage: true,
  });

  // Ask: off until turned on, asks a follow-up, answers with your own names.
  await tab("Ask").click();
  await expect(
    page.getByText("What's sent to the AI (through OpenRouter)"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/ask-consent-375.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Turn on Ask" }).click();
  await page.getByRole("button", { name: /skin treatment/ }).click();
  await expect(
    page.getByText("How much do you need, and by when?"),
  ).toBeVisible();
  await page.getByLabel("Your question").fill("₹50,000 in two weeks");
  await page.getByRole("button", { name: "Send" }).click();
  const answer = page.locator(`ol[aria-label="Conversation"] > li`).last();
  await expect(answer).toContainText("Take it from “Bank FD” first");
  await expect(answer).toContainText("Leave “House” alone");
  await expect(answer.locator("strong")).toHaveText("exit load");
  await expect(answer).not.toContainText("[I");
  await page.screenshot({ path: "test-results/ask-375.png", fullPage: true });
  // What reached the AI: codes and rounded amounts, none of your names.
  const sent = JSON.stringify(
    await (await page.request.get("http://127.0.0.1:5329/last")).json(),
  );
  for (const name of [
    "Bank FD",
    "House",
    "Index SIP",
    "Quant Mystery",
    "Bills liquid fund",
    email,
  ]) {
    expect(sent, `${name} was sent to the AI`).not.toContain(name);
  }
  expect(sent).toContain("[G1] house goal");
  // Ask can be turned off in Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Turn Ask off" }).click();
  await expect(page.getByText("Turned off")).toBeVisible();
  await tab("Ask").click();
  await expect(page.getByRole("button", { name: "Turn on Ask" })).toBeVisible();

  // Invites: hidden from normal users; admins can invite and remove people.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Invite people")).toHaveCount(0);
  const service = createClient(SUPABASE_URL, SECRET, {
    auth: { persistSession: false },
  });
  await service.from("app_admins").insert({ email });
  const friend = `friend-${Date.now()}@example.test`;
  try {
    await page.reload();
    await expect(page.getByText("Invite people")).toBeVisible();
    const people = page.getByRole("list", { name: "Invited people" });
    await expect(people).toContainText(email);
    await expect(
      people.getByRole("button", { name: `Remove invite for ${email}` }),
    ).toHaveCount(0);
    await page.getByLabel("Their email").fill(friend.toUpperCase());
    await page.getByLabel("Note (optional)").fill("Riya");
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(
      page.getByText("Invited. Now send them the message."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send invite message" }),
    ).toBeVisible();
    await expect(people).toContainText(friend);
    await expect(people).toContainText("Riya");
    await page.screenshot({
      path: "test-results/invites-375.png",
      fullPage: true,
    });
    await people
      .getByRole("button", { name: `Remove invite for ${friend}` })
      .click();
    await expect(page.getByText(`Removed ${friend}.`)).toBeVisible();
    await expect(people).not.toContainText(friend);
  } finally {
    await service.from("app_admins").delete().eq("email", email);
    await service.from("allowed_emails").delete().eq("email", friend);
  }

  // Credit cards: benefits and a spend milestone with progress.
  await tab("Cards").click();
  await expect(
    page.getByRole("heading", { name: "Cards", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Track your cards' benefits and milestones"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a card" }).click();
  await page.getByLabel("Card name").fill("Regalia Gold");
  await page.getByLabel("Annual fee").fill("2500");
  await page.getByLabel("Card year starts").fill("2026-04-10");
  await page
    .getByLabel("Benefits, one per line")
    .fill("4 lounge visits a quarter\nFuel surcharge waiver");
  await page.getByRole("button", { name: "Travel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Travel", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add card" }).click();
  const cardRow = page.getByRole("button", { name: /Regalia Gold/ });
  await expect(cardRow).toHaveAttribute("aria-expanded", "true");
  // Card details are tucked under "About this card".
  await page.getByRole("button", { name: "About this card" }).click();
  await expect(page.getByText("Fuel surcharge waiver")).toBeVisible();
  // A fee waiver milestone: progress comes from the bills you log.
  await page.getByRole("button", { name: "Add milestone" }).click();
  await page.getByRole("button", { name: "+ Annual fee waiver" }).click();
  await page.getByLabel("Spend target").fill("400000");
  await page
    .getByRole("button", { name: "Add milestone", exact: true })
    .last()
    .click();
  const feeBar = page.getByRole("progressbar", {
    name: "Annual fee waiver progress",
  });
  await expect(feeBar).toHaveAttribute("aria-valuenow", "0");
  await expect(
    page.getByText("No bills logged in this period yet"),
  ).toBeVisible();
  // Log a bill: it counts toward the milestone.
  await page.getByRole("button", { name: "Log bill" }).click();
  await page.getByLabel("Statement month").fill("2026-09");
  await page.getByLabel("Bill amount").fill("100000");
  await page.getByRole("checkbox", { name: "Paid" }).uncheck();
  await page.getByRole("button", { name: "Add due date or note" }).click();
  await page.getByLabel("Due date (optional)").fill("2026-10-05");
  await page
    .getByRole("button", { name: "Log bill", exact: true })
    .last()
    .click();
  await expect(feeBar).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByText("Counted from 1 bill")).toBeVisible();
  const bills = page.getByRole("region", { name: "Regalia Gold bills" });
  await expect(bills).toContainText("Sep 2026");
  await expect(bills).toContainText("₹1,00,000");
  await expect(page.getByText("Bill ₹1,00,000 due")).toBeVisible();
  await bills.getByRole("button", { name: "Sep 2026 bill not paid" }).click();
  await expect(
    bills.getByRole("button", { name: "Sep 2026 bill paid" }),
  ).toBeVisible();
  await expect(page.getByText("Bill ₹1,00,000 due")).toHaveCount(0);
  // Logging the same month again doesn't overwrite it.
  await page.getByRole("button", { name: "Log bill" }).click();
  await page.getByLabel("Statement month").fill("2026-09");
  await page.getByLabel("Bill amount").fill("1");
  await page
    .getByRole("button", { name: "Log bill", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("That month already has a bill. Edit it instead."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(bills).toContainText("₹1,00,000");
  // Spend since the last bill tops it up, once for the whole card.
  await page
    .getByRole("button", { name: "Edit Spent since your Sep bill" })
    .click();
  await page.getByLabel("Spent since your Sep bill").fill("300000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(feeBar).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText("Annual fee waived: reached")).toBeVisible();
  await expect(
    page.getByText("Counted from 1 bill + ₹3,00,000 not billed yet"),
  ).toBeVisible();
  // Read features: two readings, checked against the text; nothing saved
  // until chosen. Turning on AI is asked for right here.
  await page.getByRole("button", { name: "Read features" }).click();
  await page.getByRole("tab", { name: "Describe it" }).click();
  await page
    .getByLabel("What does your card give you?")
    .fill(
      "Regalia Gold, my card 4111 1111 1111 1111. Annual fee Rs 2,500 waived on spends of Rs 4 lakh in a card year. 4 reward points per Rs 150 spent. 12 complimentary lounge visits a year. Spend Rs 8 lakh in a card year for 10,000 bonus points.",
    );
  await page.getByRole("button", { name: "Read features" }).last().click();
  await expect(page.getByText("Allow AI to read this?")).toBeVisible();
  await page.getByRole("button", { name: "Allow and read" }).click();
  const found = page.getByRole("dialog", { name: "Check what was found" });
  await expect(found).toContainText("confirmed");
  const sentCard = JSON.stringify(
    await (await fetch("http://127.0.0.1:5329/last-card")).json(),
  );
  expect(sentCard).not.toContain("4111");
  expect(sentCard).toContain("[number]");
  await expect(
    found.getByRole("checkbox", { name: "Keep benefit Free golf every month" }),
  ).not.toBeChecked();
  await expect(
    found.getByRole("checkbox", {
      name: "Keep benefit 12 complimentary lounge visits a year",
    }),
  ).toBeChecked();
  await expect(
    found.getByRole("checkbox", { name: "Keep milestone Annual fee waiver" }),
  ).toBeDisabled();
  await expect(
    found.getByRole("checkbox", { name: "Keep milestone Milestone bonus" }),
  ).toBeChecked();
  await page.screenshot({ path: "test-results/card-features-375.png", fullPage: true });
  await found.getByRole("button", { name: "Save to card" }).click();
  await expect(found).toHaveCount(0);
  await expect(page.getByText("12 complimentary lounge visits a year")).toBeVisible();
  await expect(page.getByText("Free golf every month")).toHaveCount(0);
  await expect(
    page.getByRole("progressbar", { name: "Milestone bonus progress" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Regalia Gold is best for"),
  ).toContainText("Travel");
  // Which card to use: the bonus is reachable at the usual spend.
  const advisor = page.getByRole("region", { name: "Which card to use" });
  await expect(advisor).toContainText("Use Regalia Gold");
  await expect(advisor).toContainText("Within reach");
  await expect(advisor).toContainText("Based on your usual ₹1,00,000 a month");

  await page.screenshot({ path: "test-results/cards-375.png", fullPage: true });

  // The + menu: log a card bill from anywhere.
  await tab("Goals").click();
  await expect(page.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add or update" }).click();
  await expect(
    page.getByRole("dialog", { name: "What would you like to do?" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/quick-add-375.png" });
  await page.getByRole("link", { name: "Log a card bill" }).click();
  await expect(
    page.getByRole("dialog", { name: "Log a Regalia Gold bill" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/cards$/);

  // Guides in Settings: read what's new, and replay the section guides.
  await page.removeLocatorHandler(sectionGuide);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "See what's new" }).click();
  const whatsNew = page.getByRole("dialog", { name: "What's new" });
  await expect(whatsNew).toContainText("Monthly bills");
  await whatsNew.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Show guides again" }).click();
  await expect(
    page.getByText("Guides will show again when you open each section."),
  ).toBeVisible();
  await tab("Cards").click();
  const cardsGuide = page.getByRole("dialog", { name: "Tracking your cards" });
  await expect(cardsGuide).toContainText("Log bill");
  await page.screenshot({ path: "test-results/guide-375.png" });
  await cardsGuide.getByRole("button", { name: "Got it" }).click();
  await closeGuides();

  // Theme from Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Beige" }).click();
  await expect(page.getByRole("radiogroup", { name: "Accent colour" }).getByRole("radio")).toHaveCount(10);
  await page.getByRole("radio", { name: "Plum" }).click();
  await page.getByRole("button", { name: "Save look" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "beige");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "plum");
  await page.screenshot({ path: "test-results/settings-375.png", fullPage: true });
});
