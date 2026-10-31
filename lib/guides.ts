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
    intro: "Tap + near the bottom of the screen for your everyday actions.",
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
      "Goals are grouped by when they're due: the next 2 years, later, and no fixed date. A label on each says On track, Behind or what needs action. Loans covered by EMIs and reached goals are folded away.",
      "Tap +, then Update values to enter new amounts, or Import statement to update funds from a CAS.",
      "This month, above your goals, lists what to invest and where. Tick a step once you've set it up: it's added to that fund's SIP, with Undo for a few seconds.",
      "Open a goal for its What to do box. If your plan can't cover it, pick a later date, a smaller target or a bigger budget. The goal's form opens filled in for you to check and save.",
      "Edit plan sets one monthly investment budget, including what you already invest. One-time savings are optional.",
      "Plan details and options shows the goal breakdown and lets you compare one holding per goal with a spread across holdings. Nothing is saved until you confirm.",
    ],
  },
  portfolio: {
    title: "Your portfolio",
    intro: "Everything you hold, across all goals, in one place.",
    steps: [
      "Open View review for portfolio checks and settings. Turn on automatic reviews for checks after imports and holding updates. Review suggestions yourself before changing investments.",
      "The bar shows your split by asset class. Tap a part or its label to see the amount. Open By kind for the detailed breakdown.",
      "Growth compares today's value with what you put in.",
      "Tap + to update values or import a CAS statement. Tap a holding to edit it.",
    ],
  },
  cards: {
    title: "Loans and cards",
    intro: "See what needs paying, then how far each loan has come and your card milestones.",
    steps: [
      "Add each loan with its type, the amount you withdrew, the EMI and what you owe now. For a loan on a credit card, pick the card and its bill and payment dates.",
      "Each loan shows its next EMI and how soon it's due. Tap Mark paid once you've paid: what you owe goes down and the progress bar moves. Undo is there if you tapped by mistake.",
      "At the top: everything you owe, your EMIs each month, and when you'll be debt-free.",
      "EMIs on a card are part of its bill, but they don't count toward the card's milestones.",
      "Cards with overdue bills appear first. Older unpaid bills stay ahead of newer paid statements. A missing due date is shown clearly, not treated as overdue.",
      "Add a card with its annual fee, the date its card year starts, rewards and benefits. Never enter the card number.",
      "Add milestones like a fee waiver or bonus points, with the spend target and when it resets.",
      "Update spent so far whenever you check your statement. The bar shows if you're on pace.",
      "Tap + (or Log bill on a card) to record each month's statement. The card shows what's due and when; tap Mark paid right there once you've paid it.",
      "When a new card year or quarter starts, the milestone resets and asks for your new spend.",
      "Which card to use suggests where planned spending could help a milestone. Open Why this card for the breakdown. Do not spend extra just to reach a reward.",
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
