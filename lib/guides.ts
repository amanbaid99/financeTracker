// Short guides shown the first time someone opens a section, and the
// "What's new" notes shown once after a launch. Plain data, safe to use
// from server and client code.

export type GuideId =
  | "goals"
  | "portfolio"
  | "cards"
  | "ask"
  | "import"
  | "quick-add";

export interface Guide {
  title: string;
  intro: string;
  steps: string[];
}

export const GUIDES: Record<GuideId, Guide> = {
  "quick-add": {
    title: "Using the plus button",
    intro:
      "Tap + above the bottom-right corner of the navigation for your everyday actions.",
    steps: [
      "New goal adds something you want to save for.",
      "Update values lets you enter the latest amounts for your investments.",
      "Import statement reads a CAS. You review the results before saving.",
      "Plan my money helps split what you can invest across goals.",
      "Log a card bill records a statement for an existing card. Add a new card in the Cards tab.",
      "You can reopen this guide from the info button inside the + menu.",
    ],
  },
  goals: {
    title: "How goals work",
    intro:
      "Everything here starts with a goal: what you're saving for, or a loan you want to close.",
    steps: [
      "Tap Add a goal and pick a type: a purchase, a trip, an emergency fund, a bills fund or paying off a loan.",
      "Link the mutual funds, savings or deposits that pay for it. One investment can be split across goals.",
      "Tap a goal to open it. You'll see how much is saved, what's left and the monthly amount that gets you there on time.",
      "The card at the top shows what's saved, what goes in each month and how many goals are on track. Goals are grouped by when they're due, from next month to 5+ years. Must-haves come first in each group. A label on each says On track, Behind or what needs action. Covered bills funds, loans covered by EMIs and reached goals are folded away. If a bills fund develops a shortfall, it returns to the active list.",
      "Tap +, then Update values to enter new amounts, or Import statement to update funds from a CAS.",
      "A Next step card shows when there's something to do: set your budget, start a SIP plan or set up this month's SIPs. Tap Not now to hide it. Got a bonus or idle savings? Tap +, then I have extra money.",
      "Your plan has its own page: tap Your plan. It shows where the money goes and why, then This month lists what to add to your SIPs. Tick a step once you've set it up: it's added to that fund's SIP, with Undo for 10 seconds.",
      "Open a goal for its What to do box. If your plan can't cover it, it says how much more a month keeps it on track.",
      "The plan page shows what your budget allows and what your plan uses. Open Budget and plan details there for income, costs, EMIs and SIPs.",
      "Edit plan sets one monthly investment budget, including what you already invest. One-time savings are optional.",
      "Budget and plan details shows the goal breakdown and lets you compare one holding per goal with a spread across holdings. Nothing is saved until you confirm.",
    ],
  },
  portfolio: {
    title: "Your portfolio",
    intro: "Everything you hold, across all goals, in one place.",
    steps: [
      "Net worth at the top is what you own minus what you owe on loans. Tap See progress over time for charts of net worth, what you own and what you owe, plus each loan's progress.",
      "Open the Portfolio review row for checks and settings. Turn on automatic reviews for checks after imports and holding updates. Review suggestions yourself before changing investments.",
      "The overview shows your total, monthly investments and asset split. A short line sums it up, then a bar and small chips with each share. Tap a chip to filter the holdings below, and again to clear it. Switch to Instrument to see it by kind of investment, like mutual funds, stocks or EPF.",
      "Search holdings by name or category. Sort by value, name or simple growth. Unknown growth comes last. Growth compares today's value with what you put in, not an annual return.",
      "Last edited is when a holding record changed, not a market price date. CAS import dates are recorded for new successful imports; older dates may be unknown.",
      "Tap + to add an investment or saving, update values or import a CAS statement. Tap a holding to edit it.",
    ],
  },
  cards: {
    title: "Loans and cards",
    intro:
      "Your cards and their milestones, then how far each loan has come.",
    steps: [
      "Add each loan with its type, the amount you withdrew, the EMI and what you owe now. For a loan on a card, pick one of your credit cards or a separate card the lender gave you, with its bill and payment dates.",
      "Each loan shows its next EMI and how soon it's due. Tap Mark paid once you've paid: what you owe goes down and the progress bar moves. A page confirmation offers Undo for 10 seconds.",
      "Loan balances, payoff dates and elapsed EMI counts are estimates based on the schedule. Payments you explicitly record appear inside each loan. Closed loans are folded below active loans.",
      "EMIs on a card are part of its bill, but they don't count toward the card's milestones.",
      "Add a card with its annual fee, the date its card year starts, rewards and benefits. Never enter the card number.",
      "Add milestones like a fee waiver or bonus points, with the spend target and when it resets.",
      "Log each monthly statement: the month and the amount. Statements only count toward milestones. They aren't tracked as money you owe, and card-loan EMIs are left out.",
      "Tap + (or Log bill on a card) to record each month's statement. The card shows your latest statement.",
      "When a new card year or quarter starts, progress counts the statements in that new period.",
      "Open Which card to use for suggestions on where planned spending could help a milestone. Open Why this card for the breakdown. Do not spend extra just to reach a reward.",
      "Read features fills in a card from its features PDF or your description. You tick what to keep.",
    ],
  },
  ask: {
    title: "Asking about your money",
    intro:
      "Ask plain questions, like where to take money out from for a planned expense.",
    steps: [
      "Answers use your goals and investments by type and rounded amount. Your name, email and the names you gave goals and funds are never sent.",
      "Answers are general suggestions to help you think, not advice. Check before you act.",
      "You can turn Ask off any time in Settings.",
    ],
  },
  import: {
    title: "Importing a statement",
    intro: "A CAS statement updates every fund's value in one go.",
    steps: [
      "Tap How to get your statement for step by step help getting a CAS from CAMS, KFintech, NSDL or CDSL.",
      "Upload the PDF with its password. It's read on the server and the file isn't kept.",
      "Check every match and answer any questions. Nothing is saved until you confirm.",
    ],
  },
};

export const GUIDE_IDS = Object.keys(GUIDES) as GuideId[];

export interface Release {
  /** Launch date, YYYY-MM-DD. Newest first. */
  date: string;
  title: string;
  items: { title: string; text: string }[];
}

export const RELEASES: Release[] = [
  {
    date: "2026-11-08",
    title: "Simpler, back to basics",
    items: [
      {
        title: "Card statements for milestones only",
        text: "Log a statement with its month and amount, and it counts toward milestones. Card bills are no longer tracked as money you owe, so there's no due date or Mark paid for them.",
      },
      {
        title: "Net worth on Portfolio",
        text: "Net worth, what you own minus loans, sits at the top of Portfolio. Tap See progress over time for charts of net worth, what you own and what you owe, and each loan's progress.",
      },
      {
        title: "+ is back in the middle",
        text: "The + button sits in the centre of the bottom bar again, and Goals opens first.",
      },
    ],
  },
  {
    date: "2026-11-06",
    title: "Not sure how much to save?",
    items: [
      {
        title: "Net worth, over time",
        text: "Portfolio now starts with your net worth: what you own minus what you owe. Each time you add, update or remove an investment or loan, the chart gets a new point. Tap the chart to see any day.",
      },
      {
        title: "Your plan, on its own page",
        text: "Goals shows one Next step only when there's something to do, like starting a SIP plan. Extra money? Tap +, then I have extra money, to see where it helps most. Tap Your plan to see where each rupee goes and why, in the order the plan fills it, and what to add to your SIPs.",
      },
      {
        title: "A clearer Goals page",
        text: "One card shows what's saved, what goes in each month and how your goals are doing. Goals are grouped from next month to 5+ years. Mark a goal Must have or Nice to have, and must-haves come first.",
      },
      {
        title: "EMIs when they're due",
        text: "Mark paid shows for an EMI from the 1st of the month it's due, so next month's EMI doesn't ask for attention early.",
      },
      {
        title: "A plan that looks ahead",
        text: "Your plan now builds 3 months of essentials in your emergency fund first, and keeps a fifth of your monthly money for goals 5+ years away, like retirement, so they aren't always left for last.",
      },
      {
        title: "A faster app",
        text: "Each screen now loads everything it needs in one go, instead of a dozen separate requests.",
      },
      {
        title: "An easier budget",
        text: "Every line reads at a glance. Tap one to change it, or tap + to add to it, like ₹2,000 more for groceries. EMIs and SIPs sit in the same list, filled in for you, and what's free to invest follows what you type.",
      },
      {
        title: "Work it out",
        text: 'When you add a goal, tap "Not sure? Work it out". For retirement it uses your age and spending to find the amount you\'d need. For an emergency fund it counts months of essentials and EMIs. For a home, the down payment and buying costs.',
      },
      {
        title: "AI cost estimates",
        text: "For a wedding, education, a car or a trip, describe it and AI suggests a low, typical and high cost. You pick one, and the app does the maths.",
      },
    ],
  },
  {
    date: "2026-11-03",
    title: "A calmer home for your money",
    items: [
      {
        title: "Credit, with payments first",
        text: "One due list, Loans and Cards filters, quieter headers and folded history. Bill dates stay visible, and payment confirmations offer 10-second Undo. Loan schedules are clearly labelled as estimates.",
      },
      {
        title: "A clearer portfolio",
        text: "One overview, allocation filters, searchable holdings and sorting. Add investments from +. Record edit dates and new CAS import dates are shown separately.",
      },
      {
        title: "One monthly overview",
        text: "Budget and plan now share one compact card. See two investment steps first, and expand for the rest.",
      },
      {
        title: "Find the goals you need",
        text: "Tap a status to filter your goals. Covered bills funds and reached goals stay folded below the active list.",
      },
      {
        title: "Shortcuts that stay in reach",
        text: "The + button now sits in the bottom navigation. Forms keep keyboard focus inside, and investment steps offer Undo for 10 seconds.",
      },
    ],
  },
  {
    date: "2026-10-31",
    title: "One less thing to enter",
    items: [
      {
        title: "Card progress from statements",
        text: "The spent-since-last-bill field is gone. Milestones use logged bills only, excluding card-loan EMIs. Older manual unbilled amounts no longer affect progress.",
      },
    ],
  },
  {
    date: "2026-10-31",
    title: "A budget, and sharper answers",
    items: [
      {
        title: "Your month",
        text: "Add your take-home pay and monthly costs. EMIs and SIPs fill in by themselves, and you see what's free to invest. One tap uses it for This month.",
      },
      {
        title: "Ask gets the maths right",
        text: 'For "where should ₹X go?", the app works out the split with your plan\'s rules and Ask explains it. It checks whether you mean once or every month, and every number in an answer is checked against your data.',
      },
    ],
  },
  {
    date: "2026-10-31",
    title: "Loans, and smarter imports",
    items: [
      {
        title: "Loans in the Credit tab",
        text: "Cards is now Credit. Add each loan with its type, the amount withdrawn and the EMI. See the next EMI, mark it paid, and watch what you owe go down. Your loan goals are now tracked as loans too.",
      },
      {
        title: "Loans on a card",
        text: "Pick one of your credit cards, or a separate card the lender gave you, with its bill and payment dates. EMIs on your credit cards don't count toward their milestones.",
      },
      {
        title: "Imports that check with you",
        text: "After reading a CAS, you confirm the values. If one fell a lot, you're asked whether you took money out. Then you see what changed: growth, withdrawals, biggest moves and new funds.",
      },
    ],
  },
  {
    date: "2026-10-31",
    title: "Quicker everyday steps",
    items: [
      {
        title: "Cards: what's due, first",
        text: 'Each card leads with the bill due and how soon, like "due in 2 days". Tap Mark paid right on the card. The annual fee is in the card\'s details.',
      },
      {
        title: "Ask and Import",
        text: "Ask gets to the point, with the full privacy details a tap away. Import has a proper upload area and takes you back where you came from.",
      },
      {
        title: "Settings",
        text: "Your theme and colour save as soon as you tap them.",
      },
    ],
  },
  {
    date: "2026-10-31",
    title: "A calmer Goals page",
    items: [
      {
        title: "This month",
        text: "Your plan as a checklist. Tick a step once you've set it up and it's added to that fund's SIP. Undo is there for a few seconds.",
      },
      {
        title: "Grouped by when",
        text: "Goals sit under Next 2 years, Later and No fixed date, each with a short label: On track, Behind or what needs action.",
      },
      {
        title: "One thing to do",
        text: "Open a goal for one What to do box. When your plan can't cover it, choose a later date, a smaller target or a bigger budget.",
      },
      {
        title: "Fixes",
        text: "Sheets no longer sit under the tab bar, a gold ETF counts as gold and the + button moves aside while you scroll.",
      },
    ],
  },
  {
    date: "2026-10-30",
    title: "Cards with a clearer next action",
    items: [
      {
        title: "Bills before rewards",
        text: "Overdue and unpaid bills come first, including older statements. Card names have more room. Open a card for bills, milestones and benefits; expand Why this card for the reward plan.",
      },
    ],
  },
  {
    date: "2026-10-30",
    title: "A simpler monthly plan",
    items: [
      {
        title: "One budget, clear amounts",
        text: "Start with one monthly budget. Each investment shows the amount to set, with its explanation and goals a tap away. Add a one-time amount only when you need it.",
      },
    ],
  },
  {
    date: "2026-10-30",
    title: "Your holdings, sooner",
    items: [
      {
        title: "A shorter Portfolio tab",
        text: "Allocation is compact, with By kind under details. Portfolio review opens with two short takeaways. Expand a check for the explanation, with extra checks and settings tucked away.",
      },
    ],
  },
  {
    date: "2026-10-30",
    title: "More room for your goals",
    items: [
      {
        title: "A shorter start",
        text: "The separate attention summary is removed. Plan my money opens from one small row, leaving more room for your goals.",
      },
    ],
  },
  {
    date: "2026-10-29",
    title: "Your shortcuts, in one place",
    items: [
      {
        title: "A clearer plus menu",
        text: "Update values and import statements from +. A first-use hint shows where to find them, with a guide in the menu. Add cards from the Cards tab.",
      },
    ],
  },
  {
    date: "2026-10-29",
    title: "A closer look at your portfolio",
    items: [
      {
        title: "Automatic portfolio checks",
        text: "Turn on reviews in Portfolio for a full check after confirmed CAS imports. Balance updates get a quick check, with AI used only for major changes. Review concentration and money needed soon before changing investments.",
      },
    ],
  },
  {
    date: "2026-10-29",
    title: "A little more clarity for your goals",
    items: [
      {
        title: "Know where to begin",
        text: "Your next step highlights goals that need attention. Your money plan is near the top, with the details folded away.",
      },
      {
        title: "More room for what matters",
        text: "Full goal names, clearer dates and quieter progress cards. Loans covered by EMIs and goals you've reached open when you need them.",
      },
      {
        title: "Clearer actions",
        text: "Update values says what it does. Plan my money is easy to find even before you have a plan.",
      },
      {
        title: "Know what changes",
        text: "One action per investment: start a monthly amount or increase to a new total. See the overall extra amount first, with explanations under details.",
      },
      {
        title: "Compare a simpler preview",
        text: "Open Plan details and options to compare one holding per goal with a spread across holdings. Your recorded investments stay the same.",
      },
    ],
  },
  {
    date: "2026-10-27",
    title: "A calmer, simpler app",
    items: [
      {
        title: "Tabs at the bottom",
        text: "Goals, Portfolio, Cards and Ask, right under your thumb.",
      },
      {
        title: "One + button",
        text: "Add a goal, update values, log a card bill, plan your money or import a statement from anywhere.",
      },
      {
        title: "Less on each screen",
        text: "Goals show a one-line verdict. Tap Show details for the numbers.",
      },
      {
        title: "Ten accent colours",
        text: "Pick yours in Settings, under Look.",
      },
    ],
  },
  {
    date: "2026-10-26",
    title: "Credit cards",
    items: [
      {
        title: "Cards tab",
        text: "Track each card's benefits, rewards and spend milestones, with a progress bar that shows if you're on pace.",
      },
      {
        title: "Monthly bills",
        text: "Log each statement, mark it paid and see your average monthly spend per card.",
      },
      {
        title: "Which card to use",
        text: "See which card to put your spend on so you hit milestones before they reset, and which ones are out of reach.",
      },
      {
        title: "Set up a card from its features",
        text: "Upload the card's features PDF or describe it. Each fact is double checked and you choose what to keep.",
      },
      {
        title: "Guides",
        text: "Each section now has a short guide. Tap the (i) next to a page title to see it again.",
      },
    ],
  },
  {
    date: "2026-10-25",
    title: "Portfolio, Ask and statement import",
    items: [
      {
        title: "Portfolio tab",
        text: "See everything you hold, split by asset class, and how much it has grown.",
      },
      {
        title: "Ask tab",
        text: "Ask questions about your money and goals in plain words.",
      },
      {
        title: "Import a CAS statement",
        text: "Update every fund's value from one statement. You check everything before it's saved.",
      },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0].date;

/**
 * Releases to show: launched after the person joined and after the last one
 * they read. New users see none, so their first visit isn't a wall of notes.
 */
export function pendingReleases(
  seen: string | null,
  joinedISO: string,
  max = 3,
): Release[] {
  const after = seen && seen > joinedISO ? seen : joinedISO.slice(0, 10);
  return RELEASES.filter((r) => r.date > after).slice(0, max);
}
