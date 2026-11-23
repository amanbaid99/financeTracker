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
    // The + button stays in the bottom navigation while scrolling.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Add or update" }).click();
    await page.getByRole("link", { name }).click();
  };
  // Home Screen app: manifest and icons are public, and the login page links them.
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const manifestData = await manifest.json();
  expect(manifestData.icons.length).toBeGreaterThan(0);
  expect(manifestData.start_url).toBe("/today");
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
  await expect(page).toHaveURL(/\/today$/);
  const homeGuide = page.getByRole("dialog", { name: "Your money at a glance" });
  await expect(homeGuide).toBeVisible();
  await homeGuide.getByRole("button", { name: "Got it" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Goals", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveCount(5);
  // First visit: the Goals guide pops up once, and (i) brings it back.
  // A new user gets no "What's new".
  const goalsGuide = page.getByRole("dialog", { name: "How goals work" });
  await expect(goalsGuide).toBeVisible();
  await expect(page.getByRole("dialog", { name: "What's new" })).toHaveCount(0);
  const savedSeen = page.waitForResponse((r) => r.request().method() === "POST");
  await goalsGuide.getByRole("button", { name: "Got it" }).click();
  await savedSeen;
  await expect(goalsGuide).toHaveCount(0);
  // One welcome per tab: no separate hint bubble for the + button.
  await expect(page.getByRole("complementary", { name: "About the plus button" })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0)); // + hides while scrolling down
  await page.getByRole("button", { name: "Add or update", exact: true }).click();
  const shortcuts = page.getByRole("dialog", { name: "What would you like to do?" });
  await expect(shortcuts.getByRole("link", { name: /^Add a card/ })).toHaveCount(0);
  await shortcuts.getByRole("button", { name: "Guide: Using the plus button" }).click();
  const plusGuide = page.getByRole("dialog", { name: "Using the plus button" });
  await expect(plusGuide).toContainText("Add a new card in the Cards tab");
  await plusGuide.getByRole("button", { name: "Got it" }).click();
  await shortcuts.getByRole("button", { name: "Close", exact: true }).click();
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
  // Old Home aliases open Home; other legacy pages still open Goals.
  for (const old of [
    "/dashboard",
    "/month",
    "/holdings/new",
    "/budget/build",
    "/update",
    "/overview",
  ]) {
    await page.goto(old);
    await expect(page).toHaveURL(["/dashboard", "/overview"].includes(old) ? /\/today$/ : /\/goals$/);
  }
  // The session is stored in long-lived, server-set cookies (not capped at 7 days).
  const authCookies = (await page.context().cookies()).filter((c) =>
    c.name.includes("auth-token"),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  for (const c of authCookies)
    expect(c.expires * 1000 - Date.now()).toBeGreaterThan(300 * 86_400_000);

  // Empty state, then a first goal picked by type.
  await page.goto("/goals");
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
  // Goal details stay focused on actual investments; planning lives in SIP planning.
  await expect(page.getByText("How to save for it")).toHaveCount(0);
  await page.getByRole("button", {name:"Add investment",exact:true}).click();
  await expect(page.getByLabel("Fund category")).toHaveValue("equity_index");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // A mutual fund added inside a goal is linked to that goal on save.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("flexi_cap");
  await page.getByLabel("Nickname (optional)").fill("Index SIP");
  await page.getByLabel("Value today").fill("0");
  await page.getByLabel("Value today").click();
  await page.getByLabel("Value today").press("Backspace");
  await expect(page.getByLabel("Value today")).toHaveValue("");
  await page.getByLabel("Value today").pressSequentially("300000");
  await expect(page.getByLabel("Value today")).toHaveValue("3,00,000");
  await page.getByLabel("Monthly SIP").fill("10000");
  await page.getByText(/^More options/).click();
  await expect(page.getByLabel("Expected return, % a year")).toHaveAttribute(
    "placeholder",
    "11.5",
  );
  await expect(page.getByLabel("Share for this goal, %")).toHaveValue("100");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  await expect(
    page.getByRole("button", { name: "Edit Index SIP" }),
  ).toBeVisible();
  await expect(page.getByText(/Far away, so it uses equity/)).toHaveCount(0);

  // An FD as well.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Type").selectOption("fd");
  await page.getByLabel("Nickname (optional)").fill("Bank FD");
  await page.getByLabel("Value today").fill("100000");
  await page.getByRole("button", { name: "Add investment" }).last().click();
  // Explicitly adding the FD links it too, regardless of the automatic picker.
  await expect(page.getByRole("button", { name: "Edit Bank FD" })).toBeVisible();
  await expect(page.getByText("₹4,00,000", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/Put ₹[\d,]+ a month into it to be on time/),
  ).toHaveCount(0);
  await expect(page.getByText("Needed each month to be on time")).toHaveCount(0);
  await expect(page.getByText(/^\+₹[\d,]+\/mo$/)).toHaveCount(0);
  await expect(page.getByText(/^Behind/).first()).toBeVisible();
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
  await expect(page.getByText("Last confirmed balance", {exact:true})).toHaveCount(0);
  await expect(page.getByText("This month: principal")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Add investment",exact:true})).toBeVisible();
  let o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "loan goal overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/goal-loan-375.png",
    fullPage: true,
  });

  // Update the fund from the House goal; the goal follows.
  await page.getByRole("button", { name: /^House/ }).click();
  await page.getByRole("button", { name: "Edit Index SIP" }).click();
  await page.getByLabel("Value today").fill("400000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("₹4,00,000", { exact: true }).first()).toBeVisible();

  // Turn on inflation for the House goal.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel(/grow the target with inflation/).check();
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText(/grown at 6% a year/)).toHaveCount(0);

  // Update amounts for everything in one go.
  await page.evaluate(() => window.scrollTo(0, 0)); // + hides while scrolling down
  await page.getByRole("button", { name: "Add or update", exact: true }).click();
  await page.getByRole("link", { name: /^Update amounts/ }).click();
  await expect(
    page.getByText("Type in what each investment is worth today."),
  ).toBeVisible();
  await page.getByLabel("Bank FD value today").fill("120000");
  await expect(page.getByText("Was ₹1,00,000")).toBeVisible();
  await page.screenshot({ path: "test-results/update-375.png" });
  await page.getByRole("button", { name: "Save 1 change" }).click();
  await expect(page.getByText("Was ₹1,00,000")).toHaveCount(0);
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

  // SIP plan: no budget is saved yet, so the user declares available monthly savings.
  await page.goto("/goals?do=plan");
  await expect(page).toHaveURL(/\/goals\/sip$/);
  // No saved budget is required: enter an explicit available monthly amount.
  await expect(page.getByRole("heading",{name:"Your monthly SIPs"})).toBeVisible();
  await page.getByLabel("How much can you invest each month?",{exact:true}).fill("50000");
  const houseSip=page.locator("section[data-goal-id]").filter({has:page.getByRole("heading",{name:"House",exact:true})});
  await expect(houseSip.getByRole("textbox").first()).toBeVisible();
  await expect(page.getByLabel("Bank FD a month")).toHaveCount(0);
  await houseSip.getByRole("textbox").first().fill("12000");
  await expect(houseSip.getByRole("textbox").first()).toHaveValue("12,000");
  await page.screenshot({path:"test-results/sip-plan-375.png",fullPage:true});
  await page.getByRole("button",{name:"Save this plan",exact:true}).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByText("SIP plan saved.",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Plan a withdrawal",exact:true})).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.screenshot({path:"test-results/plan-375.png",fullPage:true});
  await page.getByRole("link",{name:"Goals",exact:true}).first().click();
  await page.getByRole("button",{name:/^House/}).click();
  await expect(page.getByRole("link",{name:"View monthly plan"})).toBeVisible();
  await page.getByRole("button",{name:"Edit Index SIP"}).click();
  await expect(page.getByRole("dialog",{name:"Index SIP"}).getByLabel("Monthly SIP")).toHaveValue("10,000");
  await page.getByRole("button",{name:"Close",exact:true}).click();
  // Set it up as a separate fund instead, and take the savings out of the plan.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("equity_index");
  await page.getByLabel("Nickname (optional)").fill("Planned index fund");
  await page.getByLabel("Value today").fill("280000");
  await page.getByLabel("Monthly SIP").fill("16000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add investment" })
    .click();
  // A confirmed plan keeps its mapping, so the new fund counts once the plan is confirmed again.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Coverage is a goal detail, not a separate approval inbox.
  await page.goto("/goals");
  await expect(page.getByRole("region", {name:"Suggestions"})).toHaveCount(0);
  await page.goto("/goals/sip");
  await page.getByRole("button",{name:"Save this plan",exact:true}).click();
  await expect(page).toHaveURL(/\/goals\/plan$/);
  // Extra money: where a one-time amount would go, without saving anything.
  await page.getByRole("link", { name: "Goals", exact: true }).first().click();
  await page.goto("/goals?do=extra");
  await page.getByLabel("How much?").fill("50000");
  await expect(
    page
      .getByRole("list", { name: "Where it goes" })
      .or(page.getByText(/^Your goals do(n't| not) need a one-time amount right now\.$/)),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

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
  await expect(page.getByText("Needs today")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Upcoming payments"})).toBeVisible();
  // A new goal waits for the plan to be confirmed again before money covers it.
  const billsCard = page.getByRole("button", { name: /^Bills fund/ });
  await expect(billsCard).toContainText(/% saved/);

  // Add a liquid fund, confirm the plan again, and the payments are covered.
  await page.getByRole("button", { name: "Add investment" }).click();
  await page.getByLabel("Fund category").selectOption("liquid_fund");
  await page.getByLabel("Nickname (optional)").fill("Bills liquid fund");
  await page.getByLabel("Value today").fill("30000");
  await page.getByLabel("Monthly SIP").fill("5000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add investment" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/goals/sip");
  await page.getByRole("button",{name:"Save this plan",exact:true}).click();
  await expect(page).toHaveURL(/\/goals\/plan$/);
  await page.goto("/goals");
  await billsCard.click();
  // Nothing is folded away: a covered bills fund stays in the one list.
  await expect(page.locator("main details summary", { hasText: "Covered at your current pace" })).toHaveCount(0);
  await expect(billsCard).toContainText("₹30,000 of ₹48,000");
  await expect(billsCard).toContainText(/Next: Gym, \d+ \w{3}/);
  await expect(page.getByRole("button", { name: "Edit Bills liquid fund" })).toBeVisible();
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "bills fund overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/bills-fund-375.png",
    fullPage: true,
  });

  // Home: net worth first, status, monthly actions and goals.
  await page.goto("/today");
  await expect(page.getByRole("region", { name: "How you're doing" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your money" })).toContainText("You owe");
  await expect(page.getByRole("heading", { name: "Focus goals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "EMIs in the next 30 days" })).toHaveCount(0);
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "/today overflows at 375px").toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/home-375.png", fullPage: true });
  await page.goto("/goals");

  // Import a CAS statement: bad files are refused with a plain reason.
  const PP = "Parag Parikh Flexi Cap Fund - Direct Plan Growth";
  const LIQ = "Edelweiss Liquid Fund - Direct Growth";
  const MYST = "Quant Mystery Opportunities Fund - Direct Growth";
  await page.evaluate(() => window.scrollTo(0, 0)); // + hides while scrolling down
  await page.getByRole("button", { name: "Add or update", exact: true }).click();
  await page.getByRole("link", { name: /^Import statement/ }).click();
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
  await expect(page.getByLabel(`${MYST}: goal`)).toHaveCount(0);
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
  await expect(page.getByText("Do these values look right?")).toBeVisible();
  await expect(page.getByRole("region", { name: "Will update" })).toContainText(
    "Index SIP",
  );
  await expect(page.getByRole("region", { name: "Will update" })).toContainText(
    "Current amount ₹4,00,000 → ₹4,20,000",
  );
  await expect(page.getByRole("region", { name: "Will add" })).toContainText(
    MYST,
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
  await page.getByRole("button", { name: "Yes, save" }).click();
  await expect(
    page.getByText("Updated 2 and added 1 investment."),
  ).toBeVisible();
  // Current balances are confirmed without performance commentary.
  await expect(page.getByText("Your goals now use the values from this statement.")).toBeVisible();
  await expect(page.getByText(/^Up ₹[\d,]+ since your last update$/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "What changed" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/import-confirmed-375.png", fullPage: true });
  await page.getByRole("button", { name: "Back to your goals" }).click();
  // The bills fund keeps its liquid fund, now at the statement's value.
  await page.getByRole("button", { name: /^Bills fund/ }).click();
  await expect(page.getByRole("button", { name: "Edit Bills liquid fund" })).toContainText("₹31,000");

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
  // Nothing changed, but saving still counts as this month's update.
  await expect(page.getByRole("button", { name: "Yes, save" })).toBeEnabled();
  await page.getByRole("button", { name: "Go back" }).click();

  // Portfolio: everything held, split by asset class.
  await tab("Net worth").click();
  await expect(page.getByRole("heading", { name: "Net worth", exact: true })).toBeVisible();
  // Net worth shows both sides: what you own and what you owe on loans.
  await expect(page.getByRole("region", { name: "What you owe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What you own" })).toBeVisible();
  await expect(page.getByText("Where your money is")).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Where your money is" })
      .getByRole("button", { name: /^Equity:/ }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Holdings" })).toContainText(
    "Index SIP",
  );
  await page
    .getByRole("group", { name: "Where your money is" })
    .getByRole("button", { name: /^Equity:/ })
    .click();
  await expect(page.getByRole("button", { name: "Clear asset filter" })).toBeVisible();
  await page.getByRole("button", { name: "Clear asset filter" }).click();
  await page.getByRole("searchbox", { name: "Search holdings" }).fill("Index SIP");
  await expect(page.getByRole("list", { name: "Holdings" }).locator(":scope > li")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search holdings" }).fill("");
  await page.getByRole("combobox", { name: "Sort holdings" }).selectOption("name");
  await page.getByRole("combobox", { name: "Sort holdings" }).selectOption("value");
  o = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(o, "/assets overflows at 375px").toBeLessThanOrEqual(0);
  // Edit, update or import right from Portfolio.
  await expect(page.getByRole("link", { name: "Import CAS", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Index SIP" }).click();
  await expect(page.getByRole("dialog", { name: "Index SIP" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0)); // + hides while scrolling down
  await page.getByRole("button", { name: "Add or update", exact: true }).click();
  await page.getByRole("link", { name: /^Update amounts/ }).click();
  await expect(page.getByText("Type in what each investment is worth today.")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add an investment or saving" })).toBeVisible();
  await page.screenshot({
    path: "test-results/portfolio-375.png",
    fullPage: true,
  });

  // Ask: off until turned on, asks a follow-up, answers with your own names.
  await page.getByRole("link", { name: "Ask", exact: true }).click();
  await page.getByText("What's sent to the AI", { exact: true }).click();
  await expect(page.getByText("Sent through OpenRouter:")).toBeVisible();
  await page.screenshot({
    path: "test-results/ask-consent-375.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Turn on Ask" }).click();
  await page.getByRole("button", { name: /skin treatment/ }).click();
  await expect(page.getByText(/Withdrawal preview for/).first()).toBeVisible();
  await page.getByLabel("Your question").fill("Withdraw ₹50,000");
  await page.getByRole("button", { name: "Send" }).click();
  const answer = page.locator(`ol[aria-label="Conversation"] > li`).last();
  await expect(answer).toContainText("Withdrawal preview for ₹50,000");
  await expect(answer).toContainText("Nothing is withdrawn or saved.");
  await expect(answer).not.toContainText("[I");
  await page.screenshot({ path: "test-results/ask-375.png", fullPage: true });
  // "Where should 10k go?": asks once or monthly, then the app's own split,
  // with a made-up figure caught and rewritten, and a button to add it.
  await page.getByLabel("Your question").fill("Where should 10k go?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Is ₹10,000 a one-time amount, or every month?")).toBeVisible();
  await page.getByRole("button", { name: "₹10,000 once" }).click();
  const split = page.locator(`ol[aria-label="Conversation"] > li`).last();
  await expect(split).toContainText(/as the app worked out|Nothing needs it right now/);
  await expect(split).not.toContainText("₹1,23,456");
  await expect(split).not.toContainText("Couldn't check");
  // Goals here are all covered already, so there's nothing to add.
  await expect(split.getByRole("button", { name: "Add to This month" })).toHaveCount(0);
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
  // The AI portfolio review is hidden for now.
  await tab("Net worth").click();
  await expect(page.getByRole("region", { name: "Portfolio overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Portfolio review" })).toHaveCount(0);

  // Ask can be turned off in Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Turn Ask off" }).click();
  await expect(page.getByText("Turned off")).toBeVisible();
  await page.getByRole("link", { name: "Ask", exact: true }).click();
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

  // Cards: milestones only. Loans are goals.
  await tab("Cards").click();
  await expect(page.getByRole("heading", { name: "Cards", exact: true })).toBeVisible();
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
  const cardRow = page.getByRole("button", { name: "Regalia Gold", exact: true });
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
  await cardRow.click();
  await expect(cardRow).toHaveAttribute("aria-expanded", "false");
  await expect(feeBar).toBeVisible();
  await cardRow.click();
  await expect(
    page.getByText("No bills logged in this period yet"),
  ).toBeVisible();
  // Log a bill: it counts toward the milestone.
  await page.getByRole("button", { name: /^Log a .* bill$/ }).click();
  await page.getByLabel("Statement month").fill("2026-09");
  await page.getByLabel("Bill amount").fill("100000");
  // Statements are logged for milestones only: no due date or paid state.
  await expect(page.getByRole("checkbox", { name: "I have paid this bill" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Log bill", exact: true })
    .last()
    .click();
  await expect(feeBar).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByText("Counted from 1 bill")).toBeVisible();
  const bills = page.getByRole("region", { name: "Regalia Gold bills" });
  await expect(bills).toContainText("Sep 2026");
  await expect(bills).toContainText("₹1,00,000");
  await expect(page.getByRole("region", { name: "Regalia Gold bills" })).toContainText("Sep 2026");
  await expect(page.getByRole("button", { name: /Mark .* bill paid/ })).toHaveCount(0);
  // Logging the same month again doesn't overwrite it.
  await page.getByRole("button", { name: /^Log a .* bill$/ }).click();
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
  // Milestones change only when another statement is logged, with no
  // separate "spent since your bill" entry.
  await expect(page.getByText(/Spent since your .* bill/)).toHaveCount(0);
  await page.getByRole("button", { name: /^Log a .* bill$/ }).click();
  await page.getByLabel("Statement month").fill("2026-10");
  await page.getByLabel("Bill amount").fill("300000");
  await page.getByRole("button", { name: "Log bill", exact: true }).last().click();
  await expect(feeBar).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText(/^✓ Target of ₹[\d,]+ reached$/)).toBeVisible();
  await expect(page.getByText("Counted from 2 bills")).toBeVisible();
  // Every milestone reached: the card gets a tick and says so.
  await expect(page.getByText("Milestone reached", { exact: true })).toBeVisible();
  // Read features: two readings, checked against the text; nothing saved
  // until chosen. Turning on AI is asked for right here. A card with every
  // milestone reached moves down the list, so its details may be closed.
  if (!(await page.getByRole("button", { name: "Read features" }).isVisible()))
    await page.getByRole("button", { name: "About this card" }).click();
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
  await expect(page.getByRole("region", { name: "Which card to use" })).toHaveCount(0);

  await page.screenshot({ path: "test-results/cards-375.png", fullPage: true });

  // The + menu: log a card bill from anywhere.
  await tab("Goals").click();
  await expect(page.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); // + hides while scrolling down
  await page.getByRole("button", { name: "Add or update" }).click();
  await expect(
    page.getByRole("dialog", { name: "What would you like to do?" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/quick-add-375.png" });
  await page.getByRole("link", { name: "Log card spend" }).click();
  await expect(
    page.getByRole("dialog", { name: "Log a Regalia Gold bill" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/cards$/);

  // Guides in Settings: read what's new, and replay the section guides.
  await page.removeLocatorHandler(sectionGuide);
  await page.getByRole("link", { name: "Settings" }).click();
  // Every past update on its own page, and Back returns to Settings.
  await page.getByRole("link", { name: /What's new, every update/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "What's new" })).toBeVisible();
  await expect(page.getByText("Monthly bills").first()).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).first().click();
  await expect(page).toHaveURL(/\/settings$/);
  // Help: searchable answers.
  await page.getByRole("link", { name: /Help and common questions/ }).click();
  await page.getByRole("searchbox", { name: "Search help" }).fill("net worth");
  await expect(page.getByText("How is net worth worked out?")).toBeVisible();
  await expect(page.getByText("What does AI see?")).toHaveCount(0);
  await page.getByRole("link", { name: "Settings", exact: true }).first().click();
  // The tour points at real things, moving between tabs, and can be skipped.
  await page.getByRole("button", { name: "Take the tour" }).click();
  const tourCard = page.getByRole("dialog", { name: "Your focus goals" });
  await expect(tourCard).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
  await tourCard.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog").filter({ hasText: /of 10/ })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog").filter({ hasText: /of 10/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Show guides again" }).click();
  await expect(
    page.getByText("Guides will show again when you open each section."),
  ).toBeVisible();
  await tab("Cards").click();
  const cardsGuide = page.getByRole("dialog", { name: "Cards and milestones" });
  await expect(cardsGuide).toContainText("Log bill");
  await page.screenshot({ path: "test-results/guide-375.png" });
  await cardsGuide.getByRole("button", { name: "Got it" }).click();
  await closeGuides();

  // Not sure how much? The calculator works it out and fills the goal in.
  await quick("New goal");
  await page.getByRole("button", { name: /^Retirement/ }).click();
  await page.getByRole("button", { name: /Work it out/ }).click();
  await page.getByLabel("Your age").fill("30");
  await page.getByLabel("Monthly spending today").fill("50000");
  await expect(page.getByText(/That takes about ₹[\d.]+ Cr at 60/)).toBeVisible();
  await page.getByRole("button", { name: /^Use ₹/ }).click();
  await expect(page.getByLabel("How much do you need?")).not.toHaveValue("");
  // Back is named after the screen you came from, not always "Your goals".
  await page.getByRole("main").getByRole("link").first().click();

  // Budget: income, one prefilled list of costs, then a rounded split that
  // counts existing SIPs. Saved rows open on tap.
  await tab("Budget").click();
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create budget", exact: true }).click();
  await page.getByLabel("Monthly take-home income", { exact: true }).fill("200000");
  await expect(page.getByRole("heading", {name:"Your monthly numbers"})).toBeVisible();
  await page.getByText("Add another expense",{exact:true}).click();
  await page.getByLabel("Expense name",{exact:true}).fill("Groceries");
  await page.getByLabel("A month",{exact:true}).fill("12000");
  await page.getByRole("button", {name:"Add it",exact:true}).click();
  await page.getByLabel("Personal spending a month",{exact:true}).fill("40000");
  await page.getByRole("button",{name:"Review allocation",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Your budget allocation"})).toBeVisible();
  await expect(page.getByText(/^Includes your recorded ₹[\d,]+\/mo SIPs\./)).toBeVisible();
  await page.getByRole("button", { name: "Save this budget", exact: true }).click();
  await expect(page.getByText("Budget saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Groceries" }).click();
  await page.getByLabel("Monthly amount").fill("15000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Groceries" })).toContainText("₹15,000");
  await expect(page.getByRole("link", { name: /^Use ₹[\d,]+ for Your plan$/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/budget-375.png", fullPage: true });
  // Between jobs: no salary makes the budget just monthly costs.
  await page.getByRole("button", { name: "Edit income" }).click();
  await page.getByText("No salary right now").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("needed each month until your next salary")).toBeVisible();
  await expect(page.getByRole("link", { name: /for Your plan$/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Goals", exact: true }).first().click();

  // Removed pages and old bookmarks return to Goals.
  await expect(page.getByRole("link",{name:"Your plan",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Order essentials",exact:true})).toHaveCount(0);
  for(const old of ["/goals/plan","/goals/order","/goals/roadmap"]){
    await page.goto(old);
    await expect(page).toHaveURL(/\/goals$/);
  }
  await page.goto("/liabilities/cards");
  await expect(page).toHaveURL(/\/cards$/);
  await page.goto("/liabilities");
  await expect(page).toHaveURL(/\/goals$/);

  // Removed salary-coverage links safely return to Budget.
  await page.goto("/goals/salary");
  await expect(page).toHaveURL(/\/goals\/budget$/);
  await expect(page.getByText(/^Covered till salary/)).toHaveCount(0);

  // Portfolio starts with net worth: holdings minus loans.
  await tab("Net worth").click();
  await expect(page.getByText("You owe on loans", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /See progress over time/ })).toHaveCount(0);
  await page.goto("/assets/net-worth");
  await expect(page).toHaveURL(/\/assets$/);
  await expect(page.getByRole("heading", { level: 1, name: "Net worth" })).toBeVisible();
  await expect(page.getByRole("region", { name: "What you owe" })).toBeVisible();

  // Theme from Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  const savedBeige = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("radio", { name: "Beige" }).click();
  await savedBeige;
  await expect(page.getByRole("radiogroup", { name: "Accent colour" }).getByRole("radio")).toHaveCount(10);
  // Saved as you tap: no Save button.
  const savedLook = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("radio", { name: "Plum" }).click();
  await savedLook;
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "beige");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "plum");
  await page.screenshot({ path: "test-results/settings-375.png", fullPage: true });
});
