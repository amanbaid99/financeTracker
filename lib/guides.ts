// Short guides shown the first time someone opens a section, and the
// "What's new" notes shown once after a launch. Plain data, safe to use
// from server and client code.

export type GuideId =
  | "home"
  | "goals"
  | "portfolio"
  | "cards"
  | "budget"
  | "ask"
  | "import"
  | "quick-add";

export interface Guide {
  title: string;
  intro: string;
  steps: string[];
}

export const GUIDES: Record<GuideId, Guide> = {
  home: {
    title: "Your money at a glance",
    intro: "Start here: are you okay, and what needs you this month.",
    steps: [
      "Net worth shows what you own and what you owe. A negative net worth has a light red background. Tap it for your holdings.",
      "From the 1st of each month, one line reminds you to log last month's card bills until they're all in. This month lists reminders and a card milestone when it's close.",
      "A short status highlights how you are doing and what needs attention.",
      "Focus goals shows your first three goals. The emergency fund shows how many months of costs it covers.",
    ],
  },
  "quick-add": {
    title: "Using the plus button",
    intro:
      "Tap + above the bottom-right corner of the navigation for your everyday actions.",
    steps: [
      "I have extra money previews where spare cash helps your goals. Nothing is saved until you confirm. New goal adds something you want to save for.",
      "Update amounts lets you enter the latest amounts for your investments.",
      "Import statement reads a CAS. You review the results before saving.",
      "SIP plan separates safety, lifestyle and long-term amounts, then groups vehicles within each purpose. Essentials use a separate holding from lifestyle goals. Set monthly amounts for your named holdings. Plan a withdrawal previews which holdings you could use without moving money.",
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
      "Add your mutual funds, stocks, savings and deposits. The app works out which goal each one covers, and why.",
      "Tap a goal to see what covers it and to edit it. Use +, then SIP plan for monthly allocations and planning.",
      "Focus goals shows the first three unfinished goals, followed by Other goals and then Covered. Essentials come first, then other goals by deadline. A goal on hold keeps its place.",
      "Loans can have payoff goals. Manage any loan in Net worth, even if its goal was deleted. Each shows what's left, the EMI and when it ends. Confirm the outstanding amount from your lender each month. Once confirmed, it stays until your next update. Older schedule-based balances and future payoff figures are estimates.",
      "Tap +, then Update amounts to enter new amounts, or Import statement to update funds from a CAS.",
      "Open +, then SIP plan to review goal amounts and their investment vehicles. Saving returns to Goals.",
      "Open a goal to see what covers it and its remaining gap.",
      "Essential goals come first. Other goals use priority, deadline and need, with no automatic contribution to every goal.",
      "Saving a SIP plan never starts a SIP or changes investment balances.",
    ],
  },
  portfolio: {
    title: "Your net worth",
    intro: "What you own and what you owe, in one place.",
    steps: [
      "What you owe lists each loan with its balance and how much is repaid. Tap one to manage its balance, closure or deletion. Its payoff goal is a separate link inside. Closed loans are hidden.",
      "Net worth at the top is what you own minus what you owe on loans. Current balances stay visible without performance charts.",
      "The overview shows your total, monthly investments and asset split. One bar and small chips with each share. Tap a chip to filter the holdings below, and again to clear it. Switch to Instrument to see it by kind of investment, like mutual funds, stocks or EPF.",
      "Search holdings by name or category. Sort by value or name. Upload CAS for funds and ETFs, and update other balances manually.",
      "Total value and the holding count share one line. The latest CAS import date appears when recorded; edit dates are hidden.",
      "Tap + to add an investment or saving, update values or import a CAS statement. Tap a holding to edit it.",
    ],
  },
  cards: {
    title: "Cards and milestones",
    intro:
      "Your credit cards and how close you are to fee waivers and bonus points. Nothing here counts as money you owe.",
    steps: [
      "Which card? compares reviewed cashback rules by category and amount. Lounges tracks visits from your manual log, with conditions shown beside the allowance.",
      "Each card shows its milestone target, amount left and deadline straight away. Cards with every milestone reached sit below the others. A new milestone period moves a card back up automatically.",
      "Add a card with its annual fee, the date its card year starts, rewards and benefits. Never enter the card number.",
      "Add milestones like a fee waiver or bonus points, with the spend target and when it resets.",
      "Log each monthly statement: the month and the amount. Tap +, then Log card spend, or Log bill on a card. Statements only count toward milestones.",
      "When a new card year or quarter starts, progress counts the statements in that new period.",
      "Your card terms lets you review a brochure, paste features or copy a research prompt for your AI tool. Check the official terms and confirm before saving. Detailed benefits stay collapsed.",
      "Loans, including EMIs on a card, are goals: add one with New goal, then Close my loan.",
    ],
  },
  budget: {
    title: "Your monthly budget",
    intro: "Two setup steps, then a clear saved summary.",
    steps: [
      "Create budget puts income, known EMIs, fixed costs and Personal spending on one screen. Unknown Rent and Utilities are blank.",
      "Choose how much to keep for yourself. No automatic transport or day-to-day rows are added.",
      "Review allocation shows Fixed spending, Personal spending and Save & invest. Go back to edit or save once. No SIP-plan prompt.",
      "Use the Edit controls to change amounts. Each sheet previews the resulting saving and planned SIP totals before Save.",
      "Your SIPs shows saved amounts and the remaining budget at the top. Tap Edit SIPs to change them, then Save SIPs or Cancel. Budget options beside the heading has separate SIP-only and full reset choices.",
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
  items: {
    title: string;
    text: string;
    /** Where "Show me" points for this item: a page and a data-guide. */
    show?: { path: string; target: string };
  }[];
}

export const RELEASES: Release[] = [
 {date:"2026-11-25",title:"A clearer card reader",items:[{title:"See what is happening",text:"An animated reading screen shows PDF extraction, feature checking and the review step. Nothing is saved until you confirm."}]},
 {date:"2026-11-25",title:"Card benefits, checked by you",items:[{title:"Which card and lounge visits",text:"Read a brochure, check the extracted terms and save. Compare published cashback by category and track lounge visits with a simple manual log. Detailed conditions stay tucked away and are available to Ask."}]},
 {date:"2026-11-25",title:"A small SIP requirement hint",items:[{title:"Required a month",text:"Each goal in Budget shows its required monthly SIP in small text. No extra analysis or action buttons."}]},
 {date:"2026-11-25",title:"Adjust each goal’s fund split",items:[{title:"Keep the total, choose the funds",text:"Adjust split opens a sheet with the goal total fixed. Change a fund amount and the others adjust. Save split keeps the preference and updates the investment mix. No extra amount boxes on the Budget summary."}]},
 {date:"2026-11-25",title:"A clearer Budget page",items:[{title:"Review first, edit when needed",text:"Saved SIPs are a read-only summary with the allocation gap at the top. Edit SIPs opens a draft with visible Save and Cancel. Budget edits preview their impact, setup costs can be left blank, and reset choices are clearly separated."}]},
  { date: "2026-11-25", title: "Saving and investing at a glance", items: [
    { title: "Stop new money into a holding", text: "Tick Not adding new money on a holding you're keeping but not adding to. It stays in your net worth and goals, and your SIPs skip it." },
    { title: "Where your SIPs go", text: "Your SIPs on Budget now shows your monthly total and a bar of how it splits across equity, debt, gold, cash and more." },
  ] },
  { date: "2026-11-25", title: "SIPs on your Budget", items: [
    { title: "Set them by hand", text: "Your SIPs sits under Fixed spending: one amount box per goal. It shows what's left to assign." },
    { title: "Follows Save & invest", text: "Change Save & invest and your SIPs change with it." },
    { title: "Goals see it", text: "Each goal shows its monthly amount from your SIPs and whether that's enough to be on time." },
    { title: "Split across your funds", text: "When a goal has more than one fund, a small line under its box shows the amount split equally between them." },
  ] },
 {date:"2026-11-24",title:"Fewer Home reminders",items:[{title:"Goal date prompt removed",text:"Removed the Add dates to plan your goals reminder from Home."}]},
 {date:"2026-11-24",title:"Budget edits and a real fresh start",items:[{title:"Income changes update saving",text:"Income and fixed-cost edits keep your personal spending amount and update Save & invest. Reset budget clears monthly SIP planning too. Reset SIP plan is available separately, with confirmation."}]},
 {date:"2026-11-24",title:"Budget and SIP amounts together",items:[{title:"One starting amount",text:"Save & invest sets the SIP starting amount. Budget shows the same available total and any amount awaiting allocation. Review and save to confirm updated goal amounts."}]},
 {date:"2026-11-24",title:"Clearer monthly SIP bars",items:[{title:"Allocated versus required",text:"Goal cards show a monthly allocation bar, vehicle names and amount fields. Duplicate totals, holding labels and suggestion buttons are removed."}]},
 {date:"2026-11-24",title:"Choose when SIPs start",items:[{title:"Plan ahead, then leave it steady",text:"Choose a start month in the SIP planner. Budget keeps your confirmed amounts and shows a monthly review reminder from that month onward. Nothing changes until you confirm."}]},
 {date:"2026-11-23",title:"Simpler goal editing",items:[{title:"Remove goals you no longer need",text:"Removed the Goal completed checkbox. Delete a goal from its details when you no longer need it; its investments stay."}]},
 {date:"2026-11-23",title:"Your SIP plan on Budget",items:[{title:"Save, then see the plan",text:"Saving SIPs opens Budget with your confirmed monthly total and each goal’s vehicles. Edit plan brings you back. Budget spacing and no-salary amount alignment are tidier."}]},
 {date:"2026-11-23",title:"Adjust within a goal first",items:[{title:"Keep other goals steady",text:"Entering a vehicle amount reallocates automatic money within that goal first. Other goals only change if the chosen amounts need more than the goal total."}]},
 {date:"2026-11-23",title:"SIP priority waterfall",items:[{title:"Fund priorities first",text:"Goals fill one at a time. Editing a later vehicle reduces the lowest-priority automatic allocation first. Earlier vehicle choices remain fixed."}]},
 {date:"2026-11-23",title:"Simpler SIP goal cards",items:[{title:"Only the essentials",text:"Removed Plan details from every SIP goal card. Your totals, vehicles and coverage colours stay visible."}]},
 {date:"2026-11-23",title:"Smoother SIP editing",items:[{title:"Type without waiting",text:"Vehicle amounts update as you type while projections catch up. Goal totals are text, and the emergency-cover estimate option is removed."}]},
 {date:"2026-11-23",title:"Amount fields are easier to edit",items:[{title:"Type straight over zero",text:"Tap a zero amount and start typing. Clearing a field now stays empty while you edit, even where zero is the saved default."}]},
 {date:"2026-11-23",title:"One amount box per vehicle",items:[{title:"Simpler SIP cards",text:"Goal headers show a total. Enter amounts only beside vehicles below. The emergency-cover estimate option is removed."}]},
 {date:"2026-11-23",title:"An editable SIP worksheet",items:[{title:"Goals and vehicles together",text:"Enter a large monthly total, edit goal or vehicle amounts and watch the rest recalculate. Green and red show projected funding. Dotted restore links bring suggestions back, and all linked monthly vehicles stay visible."}]},
 {date:"2026-11-23",title:"SIP planning stays separate",items:[{title:"Choose your own amount",text:"Enter a SIP planning amount without a budget limit. Saving keeps that amount when you reopen. Monthly costs for emergency cover are optional."}]},
 {date:"2026-11-23",title:"Simpler investment access",items:[{title:"Available by default",text:"Access and valuation inputs are removed. All holdings are assumed withdrawable for goal planning and withdrawal previews, including existing ELSS holdings."}]},
 {date:"2026-11-23",title:"Budget amounts line up",items:[{title:"Clearer monthly allocation",text:"Fixed, Personal and Save & invest now use aligned rows with percentages and edit icons, without cramped tiles."}]},
 {date:"2026-11-23",title:"Cleaner goals and Budget",items:[{title:"Less analysis, clearer controls",text:"Goal details focus on investments and scheduled payments. Budget shows three clear totals, direct personal and saving edits, and fixed costs without nested menus."}]},
 {date:"2026-11-23",title:"A quieter Home summary",items:[{title:"Just the progress",text:"Debt repayment shows estimated progress and payoff timing. Net worth shows only what you own and owe, with a light red background when negative."}]},
 {date:"2026-11-23",title:"Simpler goal editing",items:[{title:"No planning preferences panel",text:"Goals keep the essentials: target, date and optional inflation. Mark a goal completed directly when editing it. Previous custom assumptions stay saved."}]},
 {date:"2026-11-23",title:"Fewer pages on Goals",items:[{title:"One place to plan SIPs",text:"Your plan and Order essentials pages have been removed. Use +, then SIP plan to review monthly amounts. Saving returns to Goals. Saved plans and holdings are kept."}]},
 {date:"2026-11-23",title:"Goal-first SIP planning",items:[{title:"Build safety, then the next goal",text:"One month of emergency cover comes first, then three months. Next come payments and goals by deadline. Review one amount per goal, with suitable vehicle splits underneath and a ₹1,000 minimum per selected vehicle where possible."}]},
 {date:"2026-11-23",title:"Nearer goals come into focus",items:[{title:"Clearer goal order",text:"Essentials stay first. Other goals follow by deadline, so an old ranking cannot hide a nearer goal. Covered goals stay at the bottom. Your saved investment plan is unchanged."}]},
 {date:"2026-11-23",title:"Add an investment directly to a goal",items:[{title:"Linked when you save",text:"Add investment inside a goal now saves its coverage link too. Choose a new investment or one you already have, and review the share before saving."}]},
 {date:"2026-11-23",title:"SIP suggestions adjust around your choices",items:[{title:"One monthly total",text:"Enter an amount for any holding and the other suggestions update automatically. Your choices stay fixed when you save and reopen. Use suggestions resets your edits."}]},
 {date:"2026-11-23",title:"Enter your SIP amount directly",items:[{title:"Budget setup is optional",text:"Enter how much you can invest monthly at the top of the SIP planner. Suggestions update immediately. Your confirmed amount stays available when you reopen it."}]},
 {date:"2026-11-23",title:"Budget setup in two screens",items:[{title:"All your numbers together",text:"Income, EMIs, rent, utilities and personal spending share one screen. Next, review the allocation and save. Unknown costs start blank."}]},
 {date:"2026-11-23",title:"No automatic personal expense rows",items:[{title:"One personal amount",text:"Budget setup no longer imports old Transport or Day-to-day spending records. Choose your Personal spending amount yourself. Explicitly saved expenses are preserved."}]},
 {date:"2026-11-23",title:"One safety fund",items:[{title:"Emergency and planned bills together",text:"A combined goal keeps an emergency reserve and scheduled bills in one place. Planned bills use money above the reserve; withdrawals protect it unless you explicitly choose otherwise."}]},
 {date:"2026-11-23",title:"SIP budget amount fixed",items:[{title:"Use your saved budget",text:"The SIP planner now reads Save & invest from your saved guided budget, even when the old income records are empty. Loan costs count once. Your choices remain until you confirm."}]},
 {date:"2026-11-23",title:"Less upkeep, more clarity",items:[{title:"Let your plan run",text:"A new day no longer asks you to review a saved plan. Monthly card logging stays. Loan and CAS reviews are optional quarterly checks, with next-week snooze."},{title:"Debt at a glance",text:"Home shows expected repayment progress and payoff timing, clearly separate from your recorded balance. No payments are marked automatically."}]},
 {date:"2026-11-23",title:"Just your budget",items:[{title:"Three clear totals",text:"Create a budget with your own expenses and personal amount. No preset expense buttons or SIP-plan prompt. The summary shows Fixed spending, Personal spending and Save & invest."}]},
 {date:"2026-11-23",title:"Your personal budget first",items:[{title:"Choose what you keep",text:"In budget setup, enter your monthly Personal spending. Everything left after essentials goes to Save & invest. Review and save."}]},
 {date:"2026-11-23",title:"Unassigned money you can act on",items:[{title:"See the holding and choose",text:"Net worth names each unassigned amount. Assign it to a goal after review, or open a withdrawal preview for that holding. No money is moved."}]},
  {date:"2026-11-23",title:"One simple monthly plan",items:[
    {title:"Review once",text:"Choose monthly amounts by holding and save once. Suggestions and goal outcomes use the same calculation, within your budget."},
    {title:"Coverage stays in the background",text:"Open a goal to see what covers it or change it. No separate mapping approval list. Emergency and lifestyle money stay separate."},
  ]},
  { date: "2026-11-23", title: "A simpler SIP plan", items: [
    { title: "Every holding, one list", text: "Your monthly SIPs shows each holding with a suggested amount, ₹0 where nothing is suggested. Change any amount and save." },
  ] },
  { date: "2026-11-23", title: "An easier budget", items: [
    { title: "Three steps", text: "Income, your costs (filled in from your records, groceries and day-to-day spending included), then a rounded split that counts the SIPs you already have." },
    { title: "No salary right now", text: "Tick it and the budget becomes your monthly costs, which Covered till salary uses." },
    { title: "Tap to change", text: "Edit income, Personal or Save & invest directly from the summary. Fixed costs stay visible below. Add cost creates a new row." },
  ] },
  {date:"2026-11-22",title:"A plan that puts essentials first",items:[
    {title:"Hybrid monthly allocation",text:"Essential minimums and needs come first. Flexible goals share the remainder by priority, deadline and need. The budget is always the limit."},
    {title:"A plan you confirm",text:"Review vehicles and open Why this plan? for coverage, projections, assumptions and editable goal amounts. Saving keeps a new version; your actual SIPs and balances stay unchanged."},
    {title:"Stable coverage and history",text:"Confirmed investment shares stay pinned. Changed inputs prompt a review, while previous plan snapshots remain unchanged. Future-value targets avoid double inflation."},
  ]},
  { date: "2026-11-22", title: "Choose monthly amounts by holding", items: [
    { title: "Your actual holdings", text: "Set a monthly minimum for each named fund, stock holding, retirement account or bank account. Its existing SIP counts toward that amount. Only individual holdings are shown; previous category minimums are removed." },
    { title: "Keep essentials separate", text: "Travel and other goals no longer share new contributions with the essentials holding. Near-term lifestyle goals prefer another bank account or suitable liquid fund." },
  ] },
  { date: "2026-11-22", title: "Separate purposes, simpler Home", items: [
    { title: "Travel stays separate", text: "Monthly recommendations separate safety and essentials, lifestyle goals and long-term goals. Shared funds show separate amounts without counting contributions twice." },
    { title: "Your money at a glance", text: "Net worth now leads Home. Upcoming EMI summaries are removed; card logging, useful updates and focus goals stay." },
    { title: "Protected reserves", text: "Withdrawal previews use your selected goal first. Emergency and bill reserves stay protected unless you choose that goal." },
  ] },
  { date: "2026-11-22", title: "A calmer Home", items: [
    { title: "How you're doing, first", text: "One line at the top says if you're on track, or what needs you, and how many things there are to do this month." },
    { title: "Card bills and what's coming", text: "From the 1st of each month, one line to log last month's card bills until they're in. Then reminders and EMIs due in the next 30 days." },
    { title: "Net worth, smaller", text: "Your money sits at the bottom: what you own, what you owe and money no goal needs. The emergency fund shows months of costs." },
  ] },
  { date: "2026-11-21", title: "Your next actions on Home", items: [
    { title: "One fund can support several goals", text: "Home suggests a missing fund category only when a goal needs funding and no suitable holding exists. Similar goals share one cue. Undated purchases ask for a date first." },
    { title: "Reminders together", text: "Next up puts setup cues alongside card statements, loan balances and CAS updates. Record fund prefills only the category; choose and set up the fund with your provider, then save its record." },
  ] },
  { date: "2026-11-21", title: "Your minimums, a simpler plan", items: [
    { title: "Set a monthly minimum", text: "Enter an optional amount for each investment type you hold. Existing SIPs count toward it; recommendations use what remains. Create plan remembers your choices." },
    { title: "Just the essentials", text: "Monthly investments show the amount and covered goals without a breakdown. Net worth offers at most three simplification ideas, including reviewing extra bank accounts." },
  ] },
  { date: "2026-11-21", title: "Invest simply, see what it covers", items: [
    { title: "Investment vehicles first", text: "SIP planning and Your plan group contributions into shared vehicles. Existing SIPs count once; a short Covers line sits underneath. Nothing creates a mandate or moves money." },
    { title: "Plan a withdrawal", text: "Use + or Your plan to preview where money could come from and the effect on goals. Emergency reserves are protected by default. Ask uses the same calculation for amount-based withdrawal questions." },
  ] },
  { date: "2026-11-21", title: "Cleaner asset summary", items: [
    { title: "A simpler Net worth view", text: "Total value and the holding count share one line. Last edited dates are removed from the overview and holdings." },
  ] },
  { date: "2026-11-21", title: "Goals cover themselves", items: [
    { title: "No more linking", text: "The app works out which of your money covers which goal: safe money for what's due soon and the emergency fund, equity for goals far away. Open a goal to see Covered by and why." },
    { title: "What gets money first", text: "A third of the emergency fund, then bills and goals due this year, then the rest of the emergency fund, then your plan order. Change order on Goals moves a goal up." },
    { title: "Simplify your portfolio", text: "Net worth suggests funds you could merge, tiny holdings and money no goal needs. Ideas only; nothing is moved." },
  ] },
  { date: "2026-11-21", title: "Less clutter, clearer actions", items: [
    { title: "Editable Personal spending", text: "Edit income, Save & invest and Personal spending together. Changing one allocation adjusts the other. Rebuild with guide and salary coverage have been removed." },
    { title: "Cards focus on milestones", text: "Amount left and deadline stay visible. Open a card for pace details and editing. Which card to use has been removed." },
    { title: "Actions where you expect them", text: "Extra money and SIP plan are in +. Net worth loans open management directly, and closed loans are hidden. Your plan puts every monthly step before optional allocation details." },
  ] },
  { date: "2026-11-21", title: "Cleaner Goals and Budget", items: [{ title: "Less repetition", text: "Goals puts unfinished goals first and covered goals in their own section, with calculations behind Show details. Budget keeps three totals, a header Edit action and one SIP action; rebuild and reset live in Budget options." }] },
  { date: "2026-11-21", title: "A quieter Home", items: [{ title: "The essentials, without repeated links", text: "One balance card, a compact reminder and shorter goal and milestone summaries. Extra money stays easy to reach inside the balance card. Empty milestone cards and duplicate navigation links are removed." }] },
  { date: "2026-11-21", title: "Manage closed loans and spare money", items: [{ title: "Loan controls in Net worth", text: "Manage a loan even after its goal is deleted. Mark it closed or confirm permanent removal. Closed loans stop counting as debt or future EMIs." }, { title: "I have extra money", text: "Open the allocation preview directly from Home or the + menu. Review suggestions before adding anything to your plan." }] },
  { date: "2026-11-19", title: "All monthly SIP steps visible", items: [{ title: "No extra tap", text: "This month now shows every pending SIP step. The Show all and Show fewer controls are removed." }] },
  { date: "2026-11-19", title: "From budget to SIP plan", items: [{ title: "Review before linking", text: "Create a SIP plan from Save & invest, adjust how much to use and review the goal allocation before saving. The personal estimate calculator is removed; a manual Personal amount or standard suggestion keeps setup simple." }] },
  { date: "2026-11-19", title: "A simpler Personal spending step", items: [{ title: "Just one amount", text: "The optional estimate calculator is removed from setup and monthly editing. Enter a Personal spending amount or leave it blank for the usual recommendation." }] },
  { date: "2026-11-19", title: "Fewer budget setup screens", items: [{ title: "Answer two costs together", text: "The initial list contains recorded commitments. Groceries, everyday costs and personal transport are handled later. Missing expense questions now appear in pairs, with no default amounts." }] },
  { date: "2026-11-19", title: "Your Personal spending bucket", items: [{ title: "Transport, everyday spending and fun", text: "Personal spending brings them together. Enter one monthly personal amount in setup, or leave it blank for a suggestion. Review and save." }] },
  { date: "2026-11-19", title: "Just three budget buckets", items: [{ title: "Save & invest together", text: "One combined monthly amount for saving and investing. Annual contributions stay in Goals, so the guide skips yearly bills and buffer questions. Essentials, Save & invest and Personal spending keep the overview simple." }] },
  { date: "2026-11-19", title: "Build your budget together", items: [{ title: "Questions, then a plan", text: "Confirm income and costs, add missing essentials and let the guide recommend monthly savings, investing and spending room. Review before saving. The saved view is three compact rows with details tucked away." }] },
  { date: "2026-11-19", title: "Your budget, your rules", items: [{ title: "Set targets once", text: "Choose savings and investing percentages or fixed amounts. After commitments, the rest goes to Personal spending. Add commute and personal costs there to see what is free to spend. Confirm targets, then Save." }] },
  { date: "2026-11-19", title: "A suggested home for spare money", items: [{ title: "Review the money left", text: "After removing or reducing an item, review an editable split across savings, investing and guilt-free spending. Use this split, then Save when you are happy with it." }] },
  { date: "2026-11-19", title: "A simpler budget", items: [
    { title: "Starts from what you have", text: "A new budget fills in your recorded costs, loan EMIs and SIPs. Check it and save. The separate records page is gone: this budget is what Your plan uses." },
    { title: "What's left, in one tap", text: "The top card shows what isn't assigned yet. Send it To savings or To investing, then use it for Your plan." },
    { title: "Tap to edit, save once", text: "Rows show the amount and share of income. Tap one to change it. A bar at the bottom saves your changes, and the app warns before you leave without saving." },
  ] },
  { date: "2026-11-19", title: "Help me build my budget", items: [
    { title: "Optional assisted setup", text: "Review known costs, EMIs and recorded SIPs, add missing expenses, then edit a proposal for the money left. Savings, investing and personal amounts stay editable, and nothing is saved before your final confirmation." },
  ] },
  { date: "2026-11-19", title: "Start your budget over", items: [
    { title: "Reset budget", text: "Use Reset budget at the bottom of Budget, then confirm. It clears the saved budget and unsaved edits and starts a fresh sheet with recorded income and current EMIs. Other financial records stay intact." },
  ] },
  { date: "2026-11-19", title: "Quicker expense entry", items: [
    { title: "Common expenses and Custom", text: "Choose Rent, Utilities, EMI or another common expense instead of typing everything. Fixed costs have their own subtotal within Expenses. Custom lets you add anything else, and tracked EMIs are protected against accidental duplication." },
  ] },
  { date: "2026-11-19", title: "Clearer budget sections", items: [
    { title: "Expenses, Savings and Investments", text: "Each budget section has its own total and Add action. Rows show full names with direct amount/percentage editing. Use the pencil for name, type or removal, so the list stays easy to scan." },
  ] },
  { date: "2026-11-19", title: "See your allocation at a glance", items: [
    { title: "A balanced look at your budget", text: "The category bar shows where your income is planned, including money left unassigned. A short review recognises progress and compares saving/investing capacity with recorded goal pace. It also flags genuine gaps without rewriting your plan." },
  ] },
  { date: "2026-11-19", title: "A simple budget sheet", items: [
    { title: "Amounts and percentages, side by side", text: "Add an item, pick its category and type an amount or percentage. The other updates automatically. Loan EMIs start as fixed-expense rows. There are no split suggestions or setup steps.", show: { path: "/goals/budget", target: "budget-sheet" } },
  ] },
  { date: "2026-11-19", title: "An easier budget flow", items: [
    { title: "Salary, split, review", text: "Plan your budget one step at a time. Tap a bucket for smaller allocations in a separate panel. Loan EMIs are optional: choose which ones to include before they enter suggestions. New loans are never added automatically." },
  ] },
  { date: "2026-11-19", title: "Plan your salary your way", items: [
    { title: "A budget with your own buckets", text: "Set your salary and percentages for fixed costs, investing, debt, savings or custom buckets. Add smaller allocations inside each. Suggest a split uses your commitments and goals, then you edit and save one monthly plan.", show: { path: "/goals/budget", target: "ratio-budget" } },
  ] },
  { date: "2026-11-18", title: "A simpler home for your money", items: [
    { title: "Home brings the essentials together", text: "See current net worth, three focus goals, your card milestone with the smallest amount left and updates due. Open each section for details." },
    { title: "Simple portfolio updates", text: "Upload CAS for funds and ETFs. Update other balances manually. Performance comparisons, market-price controls and Radar have been removed. Your existing records are retained." },
  ] },
  {
    date: "2026-11-16",
    title: "A gentle reminder to stay up to date",
    items: [
      {
        title: "Updates due",
        text: "Goals shows one update at a time: missing card statements, optional quarterly loan and CAS reviews. Card reminders stay monthly; optional reviews can wait until next week. Set each card's statement day in Edit card. No payment is assumed missed.",
        show: { path: "/goals", target: "updates-due" },
      },
      {
        title: "Loan balances you confirm",
        text: "Confirm your lender's outstanding amount when reviewing it, with an optional quarterly reminder. See borrowed, outstanding and principal repaid. Confirmed balances stay until you update them; future payoff figures are estimates.",
      },
      {
        title: "CAS amounts clearly reviewed",
        text: "Review current balances from the CAS before saving. Existing statement metadata stays recorded internally.",
      },
    ],
  },
  {
    date: "2026-11-16",
    title: "Card milestones at a glance",
    items: [
      {
        title: "Progress without opening a card",
        text: "See each milestone target, the amount left and deadline right on the card. Monthly pace and calculation details stay inside. Cards with all milestones reached move below the rest and return when their period resets.",
        show: { path: "/cards", target: "cards" },
      },
    ],
  },
  {
    date: "2026-11-16",
    title: "A simpler Tracker",
    items: [
      {
        title: "Goals, Budget, Net worth and Cards",
        text: "Four tabs. Loans are goals now, with their balance going down on its own as EMIs pass. Ask is the speech bubble at the top.",
      },
      {
        title: "One list of goals",
        text: "Every goal in your order, nothing folded away. The top three are the ones to focus on first.",
        show: { path: "/goals", target: "goal-list" },
      },
      {
        title: "Net worth",
        text: "Assets is now Net worth: what you own and what you owe on one tab. Each loan shows its balance and how much is repaid.",
        show: { path: "/assets", target: "owe" },
      },
      {
        title: "A Budget tab",
        text: "Goals now shows just your goals. Budget has its own tab, with Covered till salary at the top while you're between jobs, and no red number while there's no salary.",
      },
    ],
  },
  {
    date: "2026-11-16",
    title: "A calmer plan for between jobs",
    items: [
      {
        title: "Where you are, and three things",
        text: "Goals now opens with one sentence on where you stand and at most three things to focus on. Goals on hold fold away, so the page shows only what needs you.",
      },
      {
        title: "Your roadmap",
        text: "See your plan as steps from today: first salary, bills months, loans paid off and each goal's date. Green is on plan, grey waits for salary, amber needs you.",
      },
      {
        title: "On hold, not behind",
        text: "While you're between jobs, savings goals show On hold till salary instead of Behind. Nothing asks for money until the salary starts.",
      },
    ],
  },
  {
    date: "2026-11-12",
    title: "Help, a tour and a safer app",
    items: [
      {
        title: "Take the tour",
        text: "A short walk through each tab, pointing at the real thing. Find it any time in Settings, under Help and guides.",
        show: { path: "/settings", target: "help" },
      },
      {
        title: "Help when you need it",
        text: "Search plain answers about goals, the plan, net worth, cards and privacy. Every past update is there too.",
        show: { path: "/settings", target: "help" },
      },
      {
        title: "Nothing typed is lost",
        text: "A new goal or loan keeps a draft on your phone. Open the form again and tap Restore.",
      },
      {
        title: "Back goes back",
        text: "Back now returns to the exact screen you came from.",
      },
      {
        title: "Calmer when things go wrong",
        text: "No signal or a page that won't load now shows a clear message and Try again. Your data is always safe.",
      },
    ],
  },
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
        text: "Net worth, what you own minus loans, sits at the top of Portfolio. Use current balances to see what you own and owe.",
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
        text: "One overview, allocation filters, searchable holdings and sorting. Add investments from +. The latest recorded CAS import date is shown without edit dates.",
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
        text: "After reading a CAS, review your current balances and confirm before saving. Goal progress uses the amounts you saved.",
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
        text: "Update amounts and import statements from +. A first-use hint shows where to find them, with a guide in the menu. Add cards from the Cards tab.",
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
        text: "Update amounts says what it does. Plan my money is easy to find even before you have a plan.",
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
