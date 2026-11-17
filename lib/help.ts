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
    id: "radar-company-reports",
    section: "Investment Radar",
    q: "How do I connect stock financial reports?",
    a: [
      "The optional IndianAPI connection needs a separate starter API key. Save INDIANAPI_KEY as a Secret in Vercel for Production, then redeploy. Never paste it into chat or use a public environment variable. Connection details are on Radar connection.",
      "Refresh research on an individual stock checks an exact NSE ticker or matching source-profile ISIN before fetching annual results, a balance sheet and cash flow. BSE instruments need a unique NSE counterpart matched by the same ISIN. Internal source IDs must map to the exact NSE symbol in the source exchange directory. A source-profile ISIN must exactly match the selected instrument. A conflicting or malformed ISIN stops collection. No similar company name or old-symbol guess is substituted. Up to five requests are used for a new collection; successful and partial reports are reused for 24 hours with the old retrieval date preserved.",
      "Company reports lists source coverage. A configured key can still return an identity or access error; that error leaves reports out of the assessment. Fiscal period ends are not publication dates. ISIN, currency, units and consolidated/standalone basis still need independent verification, so figures do not enter valuation scoring. A first model for profitable non-financial businesses is implemented for paper testing. It checks financial quality, valuation against comparable peers and history, growth and price conditions. Verified source inputs, historical validation and live monitoring are still needed. Source access does not enable Buy, Hold or Sell. ETF benchmark and market-timestamp work remain separate.",
    ],
    tags: "financials annual balance sheet cashflow API key IndianAPI company reports",
  },
  {
    id: "radar-automatic",
    section: "Investment Radar",
    q: "How does automatic research work?",
    a: [
      "It runs from your latest saved data when you open Radar. There is no price-rule setup step. Refresh research fetches daily prices, official ETF NAV by ISIN and available market depth. When the official same-session NAV is available, it also fetches historical NAV from MFapi using the official scheme code. The ISIN and latest NAV must match before history is kept.",
      "A verified excessive same-session premium or a verified wide spread can show Wait automatically. A NAV discount alone cannot produce a Buy candidate. Price adjustments, underlying Gold/index context, validated models and other source checks are still required.",
      "Published NAV history shows how many dates match the price history. Open Show unmatched dates to see prices-only dates, NAV-only dates and download-window differences. Equal row counts do not prove matching dates, and unmatched values are never filled in. A count difference alone does not prove bad data.",
      "The shared price, calendar and trading-depth checks cover individual stocks and ETFs on NSE/BSE. Stocks do not need NAV and never use the Gold model. ETFs with other underlying assets can collect available NAV and prices, but stay labelled model unavailable until the correct underlying and model are verified. Stock fundamentals and index valuations still need separate sources; data checks do not imply complete recommendations.",
      "Spread diagnostics distinguish no active bid/ask, an invalid response, expired or denied access, rate limits and an unavailable source. No active book can occur outside trading hours; another refresh may not help. A returned book still needs a verified source timestamp before it can pass freshness checks.",
      "Published NAV history is a secondary-source chart, not adjusted total returns. The latest point is checked against AMFI; the rest of the history, publication times and adjustments are unverified. History alone cannot enable Buy or exit recommendations.",
      "Research not ready means additional sources or model work are still needed. The first Gold model and comparison harness are implemented for paper testing, but real historical validation and live monitoring are unfinished. Refresh updates data; it cannot finish that work. No settings need changing.",
      "Hold and Review selling need ownership and portfolio/exit context. Radar can recognise an exact ISIN match in your tracked holdings, but it does not infer your desired allocation or recommend an exit from a watchlist alone. Full Buy/Hold/Sell research remains unfinished where these prerequisites are missing.",
      "Legacy ETFs saved as stocks are reclassified for display and research using provider metadata or an exact AMFI Gold ETF ISIN match. These corrections do not add holdings or rewrite your saved data in the background. Unknown ETFs and fund-of-funds wrappers are flagged for review.",
    ],
    tags: "automatic buy hold sell research ETF type classification",
  },
  {
    id: "radar-rules",
    section: "Investment Radar",
    q: "Why does Radar show Wait after my buy price was reached?",
    a: [
      "ETF entries also need official NAV matched by ISIN to the latest completed session, a timestamped spread no older than 15 minutes and at most 0.5%, and a closing premium no higher than 1%. A discount beyond 5% also pauses the entry for a source/units check. These are conservative data guardrails, not a validated valuation strategy.",
      "A fetched quote without a provider market timestamp cannot pass the freshness check. INDmoney's documented response does not include that timestamp, so the spread may be visible while ETF entries remain on Wait. NAV and current intraday prices are never mixed to claim live fair value.",
      "Daily price rules use the latest completed prior session. The verified calendar covers NSE and BSE from 9 Nov through 31 Dec 2026, including the special 8 Nov session. Other dates pause freshness-dependent conclusions until the calendar is verified. Scheduled monitoring, Telegram, balanced scoring and backtesting remain unavailable.",
    ],
    tags: "buy hold sell wait premium NAV AMFI spread timestamp ETF",
  },
  {
    id: "radar",
    section: "Investment Radar",
    q: "What does Investment Radar do?",
    a: [
      "Radar is a personal research watchlist for stocks, Gold ETFs and index ETFs you choose. It does not change holdings or net worth, and does not place trades. Only the account granted personal Radar access can use it.",
      "Search INDmoney, confirm an instrument and its asset type, then open it to fetch daily history. Indicators are provisional until corporate-action adjustments and exchange-calendar freshness are verified. A score stays unavailable while required fundamentals or ETF checks are missing.",
      "Automatic research is the main view and needs no manually configured price levels. Optional price alerts are folded below it; their entry/exit messages only compare your saved thresholds. They are not research recommendations. Drawdown alerts remain paused while price adjustments are unverified.",
      "The INDmoney token stays in Vercel as INDSTOCKS_ACCESS_TOKEN. Expired tokens must be replaced and the app redeployed. Never paste a token into chat.",
    ],
    tags: "watchlist stock ETF price research token INDmoney",
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
      "Your order: bills funds first, then the order you set with Change order, or the app's order (emergency fund first, then by when the money is needed). A goal on hold keeps its place and says so. Loans the EMIs already close come after the rest unless you place them, and goals reached come last.",
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
      "Open Your plan (on Goals) and tap I have extra money. Type the amount to see where it helps most, in the same order the plan uses. Nothing is saved until you tap Add to my plan.",
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
    section: "Net worth",
    q: "How is net worth worked out?",
    a: [
      "What you own (every investment and saving you track) minus what you owe on loans. Loan balances follow their EMI schedule, so they go down each month even before you update them.",
      "Card statements aren't counted. They're logged only for milestones, and the bank balance that pays them isn't tracked.",
      "A point is saved each day something changes. Open See progress over time on Net worth for the charts.",
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
    id: "growth",
    section: "Net worth",
    q: "What does the growth figure on a holding mean?",
    a: [
      "Today's value compared with what you put in, when you've entered or imported that. It's simple growth, not a yearly return.",
    ],
    tags: "returns gain invested",
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
      "Loans are goals. Add one with New goal, then Close my loan, with what you owe now and the EMI. A loan on a card works the same way.",
      "Open a loan and tap Update loan balance. Enter the outstanding principal from your lender and confirm. It stays until your next update, with a reminder from the 2nd each month. Amount borrowed is optional; when known, the loan card in your goals shows what's repaid of it, otherwise what's left, with the end date. If you're saving to close it early, a second bar shows that saving. Older unconfirmed balances and future payoff figures are estimates.",
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
