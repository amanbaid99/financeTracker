// Short guides shown the first time someone opens a section, and the
// "What's new" notes shown once after a launch. Plain data, safe to use
// from server and client code.

export type GuideId = "goals" | "portfolio" | "cards" | "ask" | "import" | "quick-add";

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
      "Goals needing attention come first. Loans covered by EMIs and reached goals are folded away, so you can focus on what needs you.",
      "Tap +, then Update values to enter new amounts, or Import statement to update funds from a CAS.",
      "Plan my money is above your goals. Open Review your plan for SIP suggestions, or edit what you can invest. Nothing changes until you record it.",
      "Your monthly plan tells you what amount to start or increase each investment to. Open What this supports to see the goals behind it.",
      "Plan details and options shows the goal breakdown and lets you compare one holding per goal with a spread across holdings. Nothing is saved until you confirm.",
    ],
  },
  portfolio: {
    title: "Your portfolio",
    intro: "Everything you hold, across all goals, in one place.",
    steps: [
      "Turn on automatic reviews for checks after imports and holding updates. AI prioritises anonymous checks. Review suggestions yourself before changing investments.",
      "The bar shows your split by asset class. Tap a part of it to see what's in it.",
      "Growth compares today's value with what you put in.",
      "Tap + to update values or import a CAS statement. Tap a holding to edit it.",
    ],
  },
  cards: {
    title: "Tracking your cards",
    intro: "Keep each card's benefits, milestones and monthly bills together.",
    steps: [
      "Add a card with its annual fee, the date its card year starts, rewards and benefits. Never enter the card number.",
      "Add milestones like a fee waiver or bonus points, with the spend target and when it resets.",
      "Update spent so far whenever you check your statement. The bar shows if you're on pace.",
      "Tap Log bill to record each month's statement, then Mark paid once you've paid it.",
      "When a new card year or quarter starts, the milestone resets and asks for your new spend.",
      "Which card to use suggests where to put your spend so you don't miss a milestone, based on your usual monthly bills.",
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
    date: "2026-10-30",
    title: "More room for your goals",
    items: [{ title: "A shorter start", text: "The separate attention summary is removed. Plan my money opens from one small row, leaving more room for your goals." }],
  },
  {
    date: "2026-10-29",
    title: "Your shortcuts, in one place",
    items: [{ title: "A clearer plus menu", text: "Update values and import statements from +. A first-use hint shows where to find them, with a guide in the menu. Add cards from the Cards tab." }],
  },
  {
    date: "2026-10-29",
    title: "A closer look at your portfolio",
    items: [{ title: "Automatic portfolio checks", text: "Turn on reviews in Portfolio for a full check after confirmed CAS imports. Balance updates get a quick check, with AI used only for major changes. Review concentration and money needed soon before changing investments." }],
  },
  {
    date: "2026-10-29",
    title: "A little more clarity for your goals",
    items: [
      { title: "Know where to begin", text: "Your next step highlights goals that need attention. Your money plan is near the top, with the details folded away." },
      { title: "More room for what matters", text: "Full goal names, clearer dates and quieter progress cards. Loans covered by EMIs and goals you've reached open when you need them." },
      { title: "Clearer actions", text: "Update values says what it does. Plan my money is easy to find even before you have a plan." },
      { title: "Know what changes", text: "One action per investment: start a monthly amount or increase to a new total. See the overall extra amount first, with explanations under details." },
      { title: "Compare a simpler preview", text: "Open Plan details and options to compare one holding per goal with a spread across holdings. Your recorded investments stay the same." },
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
