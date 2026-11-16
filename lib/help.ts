// The in-app Help page, in one place. Keep it in step with the app: when a
// behaviour described here changes, change its answer in the same commit.
// Plain English, short sentences, no em dashes (a test checks).

export interface HelpTopic {
  id: string;
  section: string;
  q: string;
  a: string[];
  /** Extra words people might search for. */
  tags?: string;
}

export const HELP: HelpTopic[] = [
  // Goals and the plan
  {
    id: "goal-status",
    section: "Goals",
    q: "What do On track, Behind and Not started mean?",
    a: [
      "On track: at the money going in each month, the goal reaches its target by its date.",
      "Behind today: at the current pace it falls short. Open it to see how much more a month keeps it on time.",
      "Not started: nothing is linked to it yet. Open it to link an investment or start one.",
    ],
    tags: "status label behind today",
  },
  {
    id: "goal-groups",
    section: "Goals",
    q: "What order are my goals in?",
    a: [
      "Your order: bills funds first, then the order you set with Change order, or the app's order (emergency fund first, then by when the money is needed). Goals on hold and goals reached come last.",
      "The first three are under Focus on these first. Nothing is folded away: every goal is in the list.",
    ],
    tags: "order priority top three list focus",
  },
  {
    id: "inflation",
    section: "Goals",
    q: "Why is a goal's target bigger than what I typed?",
    a: [
      "You enter the target in today's money. If prices will rise, the app grows it each year by the inflation you chose, so the money still buys the same thing when you need it.",
    ],
    tags: "inflation target future value",
  },
  {
    id: "plan-order",
    section: "Goals",
    q: "How does the plan decide where money goes?",
    a: [
      "In this order: bills funds first, so known payments are never short. Then the emergency fund, up to 3 months of essentials and EMIs, built over about a year.",
      "A fifth of the monthly money is kept for goals 5+ years away, like retirement, so they're never left for last. Nearer goals come next, by time group, must-haves first, each getting just enough to be on time.",
      "Whatever is left goes to goals with no date, by how much each still needs. The plan page shows this order with a reason for each step.",
    ],
    tags: "money plan priority split sip allocate emergency floor fifth",
  },
  {
    id: "your-order",
    section: "Goals",
    q: "Can I choose which goal comes first?",
    a: [
      "Yes. Open Your plan (on Goals, under the summary), tap Edit order, move goals up or down, then save. The plan gives each goal what it needs to be on time before moving to the next, top first. A goal without a date is built over two years.",
      "Bills funds always stay first, since a missed payment costs more. Your order replaces the app's own rules, and Use the app's order brings them back.",
    ],
    tags: "priority rank order first emergency",
  },
  {
    id: "between-jobs",
    section: "Goals",
    q: "I'm between jobs. Why do my goals say On hold till salary?",
    a: [
      "Add when your salary should start (the earliest and latest dates) in Covered till salary, at the top of the Budget tab. Until then, savings goals wait, as planned, instead of showing Behind. Bills funds and loans still show their real state.",
      "When the salary starts, tap My salary has started and your goals are active again.",
    ],
    tags: "job gap salary on hold paused",
  },
  {
    id: "runway",
    section: "Goals",
    q: "How does Covered till salary work?",
    a: [
      "It adds up everything due until your salary: EMIs from your loan goals, living costs from your budget and payments from bills funds. Then it compares that with money you can reach quickly: savings accounts, FDs and liquid funds.",
      "It works this out for both salary dates, and gives one weekly amount for day-to-day spending that keeps you covered even if salary is late.",
      "A bills-fund payment that looks like an EMI or living costs already counted isn't added twice. You can change that on each line.",
    ],
    tags: "runway cash salary weekly safe to spend",
  },
  {
    id: "plan-steps",
    section: "Goals",
    q: "What happens when I tick a step on the plan?",
    a: [
      "Ticking means you've set it up with your provider. The app raises that holding's SIP (and adds any one-time amount) and links it to the goal. Undo stays on screen for a few seconds.",
      "No money moves. The app never invests for you.",
    ],
    tags: "this month checklist tick sip",
  },
  {
    id: "extra-money",
    section: "Goals",
    q: "I have a bonus. Where should it go?",
    a: [
      "Tap +, then I have extra money. Type the amount to see where it helps most, in the same order the plan uses. Nothing is saved until you tap Add to my plan.",
    ],
    tags: "lump sum one time bonus",
  },
  {
    id: "calculator",
    section: "Goals",
    q: "How does Work it out find a goal's amount?",
    a: [
      "Retirement: the money needed to keep today's spending, grown with prices, from when you stop working until the age you plan for, while the rest keeps earning.",
      "Emergency fund: months of essential costs and EMIs. Home: the down payment plus stamp duty and other buying costs.",
      "For anything else, AI can suggest a low, typical and high cost from a short description. The app does all the maths, and you check before saving.",
    ],
    tags: "retirement corpus calculator estimate",
  },
  {
    id: "budget",
    section: "Goals",
    q: "What does the budget do?",
    a: [
      "It's a plan, not a spend tracker. Add your take-home pay and monthly costs; EMIs and SIPs fill in by themselves. What's left is free to invest, and one tap uses it for your plan.",
    ],
    tags: "income costs free to invest",
  },
  // Assets
  {
    id: "net-worth",
    section: "Assets",
    q: "How is net worth worked out?",
    a: [
      "What you own (every investment and saving you track) minus what you owe on loans. Loan balances follow their EMI schedule, so they go down each month even before you update them.",
      "Card statements aren't counted. They're logged only for milestones, and the bank balance that pays them isn't tracked.",
      "A point is saved each day something changes. Open See progress over time on Assets for the charts.",
    ],
    tags: "assets loans owe history chart",
  },
  {
    id: "liquid",
    section: "Assets",
    q: "What counts as liquid money?",
    a: [
      "Savings accounts, FDs, liquid and overnight funds: money you can reach within a day or two. Arbitrage funds aren't counted, as they take a little longer and their value moves slightly.",
    ],
    tags: "liquid emergency cash",
  },
  {
    id: "asset-classes",
    section: "Assets",
    q: "What are Retirement, Equity, Debt, Hybrid, Cash and Gold?",
    a: [
      "Retirement: EPF, PPF and NPS, locked until later. Equity: stocks and equity funds. Debt: liquid, debt and arbitrage funds and FDs. Hybrid: funds that mix equity and debt. Cash: savings accounts. Gold: gold ETFs and funds.",
      "Switch to Instrument to see the same money by kind of investment.",
    ],
    tags: "allocation asset type instrument",
  },
  {
    id: "growth",
    section: "Assets",
    q: "What does the growth figure on a holding mean?",
    a: [
      "Today's value compared with what you put in, when you've entered or imported that. It's simple growth, not a yearly return.",
    ],
    tags: "returns gain invested",
  },
  {
    id: "cas",
    section: "Assets",
    q: "How do I import a CAS statement?",
    a: [
      "Tap +, then Import statement, and pick the PDF from CAMS, KFintech, CDSL or NSDL. The password is usually your PAN. It's read privately on the server and not kept.",
      "You review every fund before anything is saved: what changed, what's new, and whether you withdrew any money.",
    ],
    tags: "import pdf mutual funds update values",
  },
  // Cards and loans
  {
    id: "loans",
    section: "Cards and loans",
    q: "Where are my loans?",
    a: [
      "Loans are goals. Add one with New goal, then Close my loan, with what you owe now and the EMI. A loan on a card works the same way.",
      "The balance goes down on its own as each EMI date passes, so there's nothing to tick. If your lender's figure is different, edit the goal and enter what you owe now.",
    ],
    tags: "loan emi debt owe balance outstanding personal card",
  },
  {
    id: "card-statements",
    section: "Cards and loans",
    q: "Why don't card bills count as money I owe?",
    a: [
      "Statements are logged only to count toward milestones like fee waivers and bonus points. You pay cards from your bank, which isn't tracked, so counting them as debt would make it look bigger than it is.",
    ],
    tags: "credit card bill statement milestone",
  },
  {
    id: "milestones",
    section: "Cards and loans",
    q: "How do card milestones count my spending?",
    a: [
      "Each logged statement in the current period counts, from when the card year or quarter starts. EMIs on the card are left out. Progress moves only when you log another statement.",
    ],
    tags: "fee waiver bonus points target",
  },
  // Ask and AI
  {
    id: "ai-privacy",
    section: "Ask and AI",
    q: "What does AI see?",
    a: [
      "Only codes and rounded amounts: your goals become [G1], [G2] and so on. Never your name, email, PAN, phone or card numbers, or the names you typed.",
      "The app does every calculation. AI only explains, and any figure it gives is checked against the app's own.",
    ],
    tags: "privacy ai ask data",
  },
  {
    id: "ask-limits",
    section: "Ask and AI",
    q: "Why did Ask say it's busy?",
    a: [
      "There's a daily limit to keep costs small. Try again later, or tomorrow. Everything else in the app works without AI.",
    ],
    tags: "limit quota error",
  },
  // The app
  {
    id: "install",
    section: "The app",
    q: "How do I add Tracker to my home screen?",
    a: [
      "iPhone: open it in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome and tap Install app in the menu.",
    ],
    tags: "pwa install home screen",
  },
  {
    id: "offline",
    section: "The app",
    q: "Does it work offline?",
    a: [
      "It opens, but your numbers need a connection, so you'll see a short offline page. Nothing is lost: try again once you're online.",
    ],
    tags: "offline no internet",
  },
  {
    id: "drafts",
    section: "The app",
    q: "I closed a form by mistake. Is it lost?",
    a: [
      "A new goal or loan keeps a draft on this phone. Open the form again and tap Restore.",
    ],
    tags: "draft unsaved lost",
  },
  {
    id: "tour",
    section: "The app",
    q: "Can I see the tour again?",
    a: [
      "Yes. Open Settings, then Help and guides, and tap Take the tour. What's new is there too, with every past update.",
    ],
    tags: "guide tour whats new",
  },
  {
    id: "advice",
    section: "The app",
    q: "Is this investment advice?",
    a: [
      "No. Suggestions use kinds of funds, never named schemes you don't hold, and they're for planning only. Check with a registered adviser before big decisions.",
    ],
    tags: "advice disclaimer",
  },
];

/** Topics matching every word of the search, in order. */
export function searchHelp(query: string, topics = HELP): HelpTopic[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return topics;
  return topics.filter((t) => {
    const text =
      `${t.section} ${t.q} ${t.a.join(" ")} ${t.tags ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
