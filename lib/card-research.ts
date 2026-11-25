/** Intentionally generic: copying this never includes private card labels or account data. */
export const CARD_RESEARCH_PROMPT = `Research the current benefits of this exact Indian credit card: [enter bank, full card name, network and variant].

Use only the issuer's official website, current benefits guide, MITC and official lounge-program pages. Do not rely on blogs or your memory. If you cannot browse or verify a term, say "Not verified". Do not mix different card variants or old terms.

Return plain text I can paste into my finance app:
1. Exact card variant and network, date checked, official source URLs and any effective/expiry dates.
2. Annual and renewal fees, GST treatment, fee-waiver thresholds and the spend exclusions.
3. Rewards by category: dining, groceries, fuel, online shopping, bills/utilities, UPI, travel and international. Include base rates, points earned per spend step, explicitly stated redemption values, caps and reset periods, merchant/MCC exclusions and qualifying spend. Quote the supporting official text. Never assume a points-to-cash value or calculate an effective reward percentage.
4. Lounge access: domestic/international, cardholder and guest visits, allowance and exact reset period (calendar quarter/year or card anniversary), whether quotas are shared, spend thresholds and qualifying period, activation/network/program requirements, participating-lounge restrictions and guest charges. Quote the supporting official text. An unused visit is not proof of eligibility.
5. Other important benefits, milestones, redemption limits, fees and exclusions.

Keep facts separate from anything not verified. Do not invent missing features. Include enough source quotes and links for a human to check each term. Do not ask for or include card numbers, account details, PAN, phone numbers or personal information.`;
