// The spotlight tour: each step points at one real element on a page,
// marked with data-guide="...". Steps only highlight and explain; the tour
// never taps or changes anything. Plain English, no em dashes.

export interface TourStep {
  /** Page the element is on. */
  path: string;
  /** Matches data-guide on the element. */
  target: string;
  title: string;
  text: string;
}

export const INTRO_TOUR: TourStep[] = [
  { path: "/today", target: "home-focus", title: "Your focus goals", text: "The first three unfinished goals in your order. Tap one for its details." },
  {
    path: "/goals",
    target: "goal-list",
    title: "Your goals, in your order",
    text: "Focus on the top three first. Tap a goal to see its plan, investments and what to do.",
  },
  {
    path: "/goals",
    target: "quick-add",
    title: "Add or update anything",
    text: "New goals, new values, a statement import or extra money: it all starts with +.",
  },
  {
    path: "/goals/budget",
    target: "budget-sheet",
    title: "Your budget",
    text: "Enter an amount or a percentage in each budget row. The other updates for you.",
  },
  {
    path: "/assets",
    target: "net-worth",
    title: "Your net worth",
    text: "Your recorded holdings minus loan balances. Upload CAS or update amounts to keep it current.",
  },
  {
    path: "/assets",
    target: "owe",
    title: "What you owe",
    text: "Each loan with its balance and how much is repaid. Tap one to open its goal.",
  },
  {
    path: "/assets",
    target: "allocation",
    title: "Where your money is",
    text: "By asset type or by instrument. Tap a chip to filter your holdings.",
  },
  {
    path: "/cards",
    target: "cards",
    title: "Cards and milestones",
    text: "Log each statement and see how close you are to fee waivers and bonus points.",
  },
  {
    path: "/ask",
    target: "ask",
    title: "Ask in plain words",
    text: "Like where to take money out from. The app does the maths; AI only explains.",
  },
  {
    path: "/settings",
    target: "help",
    title: "Help any time",
    text: "Answers to common questions, every past update, and this tour again.",
  },
];
