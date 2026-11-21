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
  {
    id: "home",
    section: "Getting started",
    q: "What is on Home?",
    a: [
      "Home shows one net-worth card, a compact update reminder, your first three unfinished goals and the closest unfinished card milestone. Tap the net-worth card for holdings, a goal for its details, or the milestone for its card. I have extra money and SIP plan are in the + menu. Empty milestone cards are hidden; a first-goal action appears only when you have no goals.",
    ],
    tags: "overview focus dashboard",
  },
  {
    id: "current-balances",
    section: "Net worth",
    q: "How do I keep my balances up to date?",
    a: [
      "Upload CAS for funds and ETFs, review the amounts and confirm before saving. Use Update amounts for other balances such as savings, EPF and US stocks. The app shows recorded balances, without gains, losses or live market-price tracking.",
    ],
    tags: "manual CAS amounts portfolio",
  },
  {
    id: "updates-due",
    section: "Goals",
    q: "What appears in Updates due?",
    a: [
      "One update at a time on Goals. Missing card statements use the statement day in Edit card. Days beyond the end of a month use its last day. Without a statement day, card reminders stay off.",
      "Loan balance updates start on the 2nd. Monthly CAS reminders start on the 5th when you hold mutual funds. Saving a relevant update clears its reminder. Remind me tomorrow postpones that item until the next day, across your devices.",
      "A missing statement or balance update never means you missed a payment. Card statements count only for milestones; the app does not track card payment confirmations.",
    ],
    tags: "reminder nudge statement monthly CAS loan balance snooze",
  },
  // Goals and the plan
  {
    id: "goal-status",
    section: "Goals",
    q: "What do On track, Behind and Not started mean?",
    a: [
      "On track: at the money going in each month, the goal reaches its target by its date.",
      "Behind: at the current pace it falls short. Open it to see how much more a month keeps it on time.",
      "Not started: none of your money suits it yet. Open it to see what kind of investment would.",
    ],
    tags: "status label behind today",
  },
  {
    id: "goal-cover",
    section: "Goals",
    q: "How does the app decide which money covers which goal?",
    a: [
      "You don't link investments to goals any more. The app splits your money across goals by itself, each time you open it, and saves nothing.",
      "Order: the emergency fund gets a third of its target first, then bills funds and goals due within a year (soonest first), then the rest of the emergency fund, then every other goal in your plan order.",
      "Each goal only uses money that suits its timeline: safe money (savings, liquid funds, FDs) for the next year, low-risk funds for 1 to 3 years, hybrid funds and some equity for 3 to 5 years, and equity for longer. Equity is never used for money needed within a year.",
      "A goal more than a year away needs less today, because the money it takes can grow until then. Bigger holdings are used first, so each goal uses as few as it can.",
      "Open a goal to see Covered by and one line on why. If a goal is short, it gets what's available and shows what's left. Money no goal needs shows on Net worth.",
      "To change what gets money first, use Change order on Goals.",
    ],
    tags: "auto allocate link map which fund covers goal priority emergency sinking",
  },
  {
    id: "goal-simplify",
    section: "Net worth",
    q: "What is Simplify your portfolio?",
    a: [
      "Ideas for having fewer things to track: several funds of the same type, tiny holdings with no SIP, and money no goal needs right now. It only names funds you already hold.",
      "Nothing is sold or moved. Check exit loads and tax before you sell anything. Not investment advice.",
    ],
    tags: "simplify merge consolidate liquid funds small holdings spare",
  },
  {
    id: "goal-groups",
    section: "Goals",
    q: "What order are my goals in?",
    a: [
      "Your order: bills funds first, then the order you set with Change order, or the app's order (emergency fund first, then by when the money is needed). A goal on hold keeps its place and says so. Loans the EMIs already close come after the rest unless you place them, and goals reached come last.",
      "The first three unfinished goals are under Focus goals, followed by Other goals. Reached goals have their own Covered section at the bottom. Every goal stays visible. Open a goal for its plan and investments; Show details reveals exact totals and calculations.",
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
    id: "plan-steps",
    section: "Goals",
    q: "What happens when I tick a step on the plan?",
    a: [
      "Ticking means you've set it up with your provider. The app raises that holding's SIP (and adds any one-time amount). Undo stays on screen for a few seconds.",
      "No money moves. The app never invests for you.",
    ],
    tags: "this month checklist tick sip",
  },
  {
    id: "extra-money",
    section: "Goals",
    q: "I have a bonus. Where should it go?",
    a: [
      "Tap I have extra money in the + menu from any main tab. Type the amount to see where it helps most, in the same order the plan uses. Nothing is saved until you tap Add to my plan.",
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
    section: "Budget",
    q: "How does the budget work?",
    a: [
      "Tap Plan my budget for a guided setup: take-home income, recorded commitments you confirm, paired questions about missing essentials and an optional personal-spending preference. No percentages, annual contributions or savings-versus-investing split are required.",
      "The guide recommends one monthly Save & invest amount. Adjust it before Save this budget. Personal spending gets what is left after Essentials and Save & invest. Annual contributions remain in Goals and are not imported or added here.",
      "Without a spending preference, the starting amount is 25% of income, capped at half the money left after essentials. The remainder goes to Save & invest. This is an editable starting point, not an ideal ratio or investment advice.",
      "Personal spending includes transport, day-to-day personal purchases and guilt-free money. Enter one optional monthly amount in setup, or leave it blank for a recommendation. Review the suggested plan before saving.",
      "After saving, Essentials, Save & invest and Personal spending show their monthly totals. Only buckets with named items expand into a breakdown. Tap Edit beside income for monthly amounts; Edit includes take-home, Save & invest and Personal spending. Changing either allocation adjusts the other; included costs stay unchanged. Budget options holds Reset budget. Removing a cost increases Personal spending, keeping the combined target fixed.",
      "Existing savings and investing rows appear under the combined total without rewriting stored amounts. Existing annual provision rows stay until you explicitly edit or reset the budget. Goals, SIPs and investment records are separate, and no actual spending is tracked.",
    ],
    tags: "income costs expenses budget free to invest plan",
  },
  {
    id: "budget-reset",
    section: "Budget",
    q: "How do I reset my budget and start over?",
    a: [
      "Below the saved budget, open Budget options, choose Reset budget, then Reset and start over. Keep my budget or closing the panel cancels without deleting anything.",
      "Reset removes only your saved budget and returns to Plan my budget. Your loans, holdings, SIPs, income records, goals and cards stay as they are. Reset cannot be undone. If it fails, your budget remains visible with an error.",
    ],
    tags: "delete clear budget start over reset",
  },
  {
    id: "budget-recommendation",
    section: "Budget",
    q: "Does the budget guide use AI or my existing goals?",
    a: [
      "The guide uses local, checked calculations from the answers you give. It works without an AI key. It does not send your costs or names to an AI service, import existing SIP amounts, or change goal allocations. This keeps the budget independent and makes every recommended amount explainable.",
    ],
    tags: "guided budget recommendations AI goals SIP independent",
  },
  {
    id: "budget-sip",
    section: "Budget",
    q: "Can I create a SIP plan from Save & invest?",
    a: [
      "Choose Save & create SIP plan at the end of setup, or Create a SIP plan on your saved budget. The Save & invest amount prefills a separate review screen. Lower it if some money should stay as accessible savings.",
      "Review how the monthly amount supports your goals. Existing SIPs count within the total, not on top. Save SIP plan explicitly sets the monthly amount for Your plan; no SIP mandate, investment record or trade is created. Your budget remains unchanged. Any existing one-time planning amount is kept.",
    ],
    tags: "budget sip save invest monthly allocation plan",
  },
  // Assets
  {
    id: "net-worth",
    section: "Net worth",
    q: "How is net worth worked out?",
    a: [
      "What you own (every investment and saving you track) minus what you owe on loans. Loan balances follow their EMI schedule, so they go down each month even before you update them.",
      "Card statements aren't counted. They're logged only for milestones, and the bank balance that pays them isn't tracked.",
      "Net worth uses recorded holdings and loan balances. It does not show a performance chart.",
    ],
    tags: "assets loans owe history chart",
  },
  {
    id: "liquid",
    section: "Net worth",
    q: "What counts as liquid money?",
    a: [
      "Savings accounts, FDs, liquid and overnight funds: money you can reach within a day or two. Arbitrage funds aren't counted, as they take a little longer and their value moves slightly.",
    ],
    tags: "liquid emergency cash",
  },
  {
    id: "asset-classes",
    section: "Net worth",
    q: "What are Retirement, Equity, Debt, Hybrid, Cash and Gold?",
    a: [
      "Retirement: EPF, PPF and NPS, locked until later. Equity: stocks and equity funds. Debt: liquid, debt and arbitrage funds and FDs. Hybrid: funds that mix equity and debt. Cash: savings accounts. Gold: gold ETFs and funds.",
      "Switch to Instrument to see the same money by kind of investment.",
    ],
    tags: "allocation asset type instrument",
  },
  {
    id: "cas",
    section: "Net worth",
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
      "Loans are tracked separately from their payoff goals. Add one with New goal, then Close my loan. Open Net worth, What you owe, and tap Manage loan to update, mark it closed or delete it, even if the payoff goal was removed.",
      "Open a loan and tap Update loan balance. Enter the outstanding principal from your lender and confirm. It stays until your next update, with a reminder from the 2nd each month. Amount borrowed is optional; when known, the loan card in your goals shows what's repaid of it, otherwise what's left, with the end date. If you're saving to close it early, a second bar shows that saving. Older unconfirmed balances and future payoff figures are estimates.",
      "Deleting a payoff goal does not close its loan. Mark closed / foreclosed sets the outstanding balance to zero, removes future EMIs and keeps history while hiding the closed loan from the page. Permanently deleting an unlinked loan also removes its recorded payment history, after confirmation. If a payoff goal is still linked, close the loan or remove the payoff goal first.",
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
      "Each logged statement in the current period counts, from when the card year or quarter starts. EMIs on the card are left out. Progress moves only when you log another statement. Each milestone shows whether you're on pace, what's left, about how much a month reaches it in time, and the deadline. Annual fee waiver is a target, not confirmation from the bank. Open a card to see which statements counted. Tap a milestone to edit it. Cards with every milestone reached get a tick, stay short until you open them, and appear last; a card with another unfinished milestone stays above them. When a milestone period resets, the card returns to the active list.",
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
