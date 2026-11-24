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
      "Your net worth leads Home, with what you own and owe. See a short status, one reminder to log last month’s card bills, useful monthly actions and three focus goals. Emergency progress is shown in months of costs. Upcoming EMI summaries are not shown.",
      "Tap any part to open its tab. Open +, then SIP plan to review monthly contributions.",
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
    q: "What appears in This month on Home?",
    a: [
      "Monthly card logging remains on Home. Missing card statements use the statement day in Edit card. Days beyond the end of a month use its last day. Without a statement day, card reminders stay off.",
      "Loan and investment refreshes appear separately as Optional quarterly review, three months after the last known balance or CAS upload. They do not add to Home's task count. Remind me next week postpones an optional review; cards keep Remind me tomorrow. You can update values sooner whenever you choose.",
      "Home shows a debt progress bar, estimated percentage repaid and payoff timing. Home net worth uses a light red background when negative and shows only assets and liabilities. Recorded balances stay unchanged until you confirm a real update. A saved investment plan does not need review merely because a calendar day passed.",
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
      "The planner proposes percentage ownership of your existing investments. Confirming a plan saves that mapping. Confirmed shares stay in place until you approve a new plan; only unassigned ownership is available for extra mapping.",
      "An investment can support several goals, but its total assigned share cannot exceed 100%. Current allocated values follow its recorded balance. Deleting a goal releases its allocation without deleting the investment. When you no longer need a goal, delete it from its details.",
      "Essentials and flexible goals use separate holdings for new planning. Travel prefers a suitable separate bank account or another liquid fund. Missing suitable vehicles are shown as categories, never invented products.",
      "Assigned holdings count toward coverage. For now, the app assumes all holdings are withdrawable. No live prices or automatic trades are used.",
    ],
    tags: "auto allocate link map which fund covers goal priority emergency sinking",
  },
  {
    id: "goal-suggestions",
    section: "Goals",
    q: "How do I change which investments cover a goal?",
    a: [
      "Open a goal to see Covered by. The app proposes suitable existing investments in the background when you create your monthly plan. Review and save once; there is no separate mapping approval list.",
      "Adding an investment from a goal links it to that goal when you save. You can create a new investment or choose one you already have, with a share of the holding for this goal. For a manual change, tap Change what covers this goal inside its details. Other goals keep their allocations. If your chosen share is already used, the edit is rejected without changing your previous coverage.",
    ],
    tags: "suggestions accept change mapping merge move sell simplify",
  },
  {
    id: "goal-simplify",
    section: "Net worth",
    q: "What is Simplify your portfolio?",
    a: [
      "Up to three ideas for having fewer things to track: extra bank accounts, several funds of the same type, tiny holdings with no SIP, with a separate Money not assigned to goals card. Bank-account reviews include salary credits, EMIs, UPI, autopay and minimum balances. A small balance alone does not mean an account is unused. It only names funds you already hold.",
      "Money not assigned to goals names each holding and its free amount. Assign to a goal lets you choose a goal and amount, then confirm. Plan a withdrawal opens a preview for that holding, not an order to sell. All holdings are assumed withdrawable for planning. Update balances only after an actual withdrawal.",
      "Nothing is sold or moved. Check exit loads and tax before you sell anything. Not investment advice.",
    ],
    tags: "simplify merge consolidate liquid funds small holdings spare",
  },
  {
    id: "goal-groups",
    section: "Goals",
    q: "What order are my goals in?",
    a: [
      "Essentials come first, with bills funds at the top and your saved essential order respected. Flexible goals follow by nearest deadline; old flexible rankings do not hide nearer goals. Undated goals follow dated ones. A goal on hold keeps its place. Loans the EMIs already close come after the rest unless placed in your essential order. Covered goals stay at the bottom.",
      "The first three unfinished goals are under Focus goals, followed by Other goals. Reached goals have their own Covered section at the bottom. Every goal stays visible. Open a goal to see covering investments, edit or remove it, and see its next three scheduled bills. Monthly requirements, forecasts and planning belong in the SIP planner.",
    ],
    tags: "order priority top three list focus",
  },
  {
    id: "inflation",
    section: "Goals",
    q: "Why is a goal's target bigger than what I typed?",
    a: [
      "In the goal form, Prices will rise adds the inflation rate you enter. Leave it off for an exact future amount. Existing future-value goals start with inflation off, so the target is not inflated twice. Saved targets and custom assumptions are preserved.",
      "Funding projections use effective monthly returns and month-end contributions. Existing assigned investments grow separately at their own stated or conservative assumed returns. Planned SIPs are not counted as existing corpus. Bills also check payment dates so an early cash gap cannot be hidden by a later monthly contribution.",
    ],
    tags: "inflation target future value",
  },
  {
    id: "plan-order",
    section: "Goals",
    q: "How does the plan decide where money goes?",
    a: [
      "The monthly SIP planner builds one month of emergency cover, then three months, using accessible recorded balances and essential costs plus EMIs. It then fills monthly requirements for upcoming payments and goals in nearest-deadline order. A combined emergency / sinking fund is counted once.",
      "Each goal has one monthly amount. It is split across suitable linked vehicles with at least ₹1,000 each where possible. ₹1,200 stays in one vehicle; ₹2,400 can use two at ₹1,200 each. Smaller amounts stay in one. Money is never increased just to meet a minimum. Unneeded money stays unallocated.",
      "Any saved extra cash buffer reduces available savings. Existing SIPs are displayed separately, and no recommendation can exceed the budget. A zero surplus produces no new monthly allocation.",
    ],
    tags: "money plan priority split sip allocate emergency floor fifth",
  },
  {
    id: "plan-steps",
    section: "Goals",
    q: "What happens when I confirm my plan?",
    a: [
      "A saved plan remains in place across calendar days. Changed financial inputs or calculation rules can request a review; simply opening the app tomorrow does not. Loan and CAS reminders are optional quarterly checks. Monthly card logging stays unchanged.",
      "The SIP planner separates the recommendation, the plan you confirm and your recorded investments. Save this plan saves a new immutable version and coverage mapping. It does not start a SIP, move money or increase a balance.",
      "After actually setting up a provider SIP or making a transaction, record the resulting SIP or balance in Net worth, or review and confirm a CAS import. Existing recorded SIPs are never silently cut to fit a new recommendation.",
    ],
    tags: "this month checklist tick sip",
  },
  {
    id: "extra-money",
    section: "Goals",
    q: "I have a bonus. Where should it go?",
    a: [
      "Tap I have extra money in the + menu. It previews a bonus or gift separately from monthly income. Nothing is saved or invested. Record received money in Net worth and then review your savings plan; never add it again as an existing asset and a new contribution.",
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
      "Tap Create budget. Two screens: enter income, fixed costs and personal spending together, then review the allocation and save.",
      "Known fixed costs and EMIs come from your records. Rent and Utilities stay blank when unknown. Transport and day-to-day spending are not added automatically; choose one Personal spending amount instead. Untick anything you don't pay, fix amounts, or add an expense by name and amount.",
      "With a salary, choose how much to keep for Personal spending, including your day-to-day costs and personal costs already listed. Save & invest is exactly what remains after essentials and that personal amount. Existing SIPs count inside Save & invest. If this is less than your running SIPs, review them with your provider; the app does not change them.",
      "With no salary right now, the budget is just your monthly costs. Covered till salary uses it to show how long your money lasts.",
      "After saving, tap Personal or Save & invest in the summary to edit that amount. Fixed costs stay visible below: tap a row to edit or remove it, or use Add cost. Personal details appear only if you have named personal costs. Tap Edit beside income to change it. Each change saves only when you tap Save.",
      "Budget options has Run setup again and Reset budget. No actual spending is tracked.",
    ],
    tags: "income costs expenses budget free to invest plan",
  },
  {
    id: "budget-reset",
    section: "Budget",
    q: "How do I reset my budget and start over?",
    a: [
      "Below the saved budget, open Budget options, choose Reset budget, then Reset and start over. Run setup again goes through the three steps without deleting first. Keep my budget or closing the panel cancels without deleting anything.",
      "Reset removes only your saved budget and returns to Create budget. Your loans, holdings, SIPs, income records, goals and cards stay as they are. Reset cannot be undone. If it fails, your budget remains visible with an error.",
    ],
    tags: "delete clear budget start over reset",
  },
  {
    id: "budget-recommendation",
    section: "Budget",
    q: "Does the budget guide use AI or my existing goals?",
    a: [
      "The guide uses local, checked calculations from the answers you give. It works without an AI key. It does not send your costs or names to an AI service or change goal allocations. It counts your existing SIPs within Save & invest. This keeps the budget independent and makes every recommended amount explainable.",
    ],
    tags: "guided budget recommendations AI goals SIP independent",
  },
  {
    id: "budget-sip",
    section: "Budget",
    q: "How do I plan my monthly SIPs?",
    a: [
      "Enter How much can you invest each month? Choose Start contributions from to plan a later start. Projections count full monthly periods, with no new contributions before that month. Existing balances and goal deadlines stay as recorded. This is a standalone planning amount: Budget is not read, used as a limit or changed. Your monthly SIPs lists goals and their investment destinations. There is no emergency-cover estimate input or Plan details section.",
      "The emergency goal’s saved requirement comes first, followed by payments and goals in deadline order. Current recorded balances count toward runway under the all-holdings-available assumption, not future market growth or future SIPs. After recording emergency deposits, review the plan so new money can move to the next goals. A zero SIP planning amount creates no contributions. ",
      "Goals follow emergency and deadline priority. Vehicles inside each goal are sorted by suitability and existing SIPs. All linked monthly vehicles stay visible, including ₹0 suggestions. Each goal receives its full monthly requirement before the next goal. Change a vehicle to update its read-only goal total. First, other automatic vehicles in the same goal adjust so its total stays unchanged. Only when the chosen vehicle amounts exceed that goal total does it use money from the lowest-priority automatic goals, preserving higher-priority funding where capacity allows. Earlier vehicle choices stay fixed, but earlier whole-goal totals are released so their automatic portions can adjust. All choices stay within the monthly total. There are no suggestion or reset buttons in the goal cards. If the goal has only one suitable vehicle, reducing it reduces the goal total rather than adding another fund.",
      "Each goal bar runs from ₹0 to its calculated monthly requirement and shows the amount allocated this month. Green means that monthly requirement is covered; red means more monthly allocation is needed. It does not represent projected corpus or guaranteed returns. Saving takes you to Budget, where your confirmed monthly SIP total, start month, goals and vehicles appear together. The amounts stay fixed until you confirm a replacement. From the start month onward, a new calendar month after your last save shows a review reminder. Review your balances and provider SIPs first; no deposits or changes are assumed. Edit plan reopens your saved goal and vehicle choices. No provider SIP or actual balance changes.",
    ],
    tags: "budget sip save invest monthly allocation plan",
  },
  {
    id:"combined-safety",section:"Goals",q:"How does Emergency / sinking fund work?",
    a:["It is one goal and one pool of investment ownership. Its target includes an emergency reserve plus planned bills. Bill amounts and dates stay intact; their funding is calculated in addition to building the reserve.","Edit the goal to change the reserve or its deadline. The reserve is built by the earlier of that deadline and twelve months. A planned withdrawal from this goal protects the reserve unless you select Use the emergency reserve too. Nothing is withdrawn automatically."],tags:"emergency sinking reserve bills combined safety"
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
      "Open a loan and tap Update loan balance. Enter the outstanding principal from your lender and confirm. It stays until your next update, with a reminder at an optional quarterly review. Amount borrowed is optional; when known, the loan card in your goals shows what's repaid of it, otherwise what's left, with the end date. If you're saving to close it early, a second bar shows that saving. Older unconfirmed balances and future payoff figures are estimates.",
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
  {
    id: "withdrawal-preview",
    section: "Net worth",
    q: "Where should I withdraw money from?",
    a: [
      "Open +, then Plan a withdrawal. Enter the amount and choose its goal or Something else. The preview uses money covering the selected goal first, then unassigned accessible money. Considering other goals needs your explicit choice. Emergency and bill reserves remain protected unless you select that goal.",
      "It compares the lower balances with current goal targets unchanged and shows additional funding gaps. Completing a goal is a separate update. Tax, exit loads, settlement, units and lot-level locks are not calculated. All holdings are included under the current availability assumption. Confirm access with your provider, then update balances after withdrawing. Nothing is sold or saved by the preview.",
      "In Ask, an amount-based withdrawal question uses this same local calculation instead of AI arithmetic. General conversation still uses Ask consent and its normal AI settings.",
    ],
    tags: "withdraw redeem spend source money impact goals",
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
