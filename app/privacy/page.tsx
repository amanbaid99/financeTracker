import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { DISCLAIMER, PRIVACY_VERSION } from "@/lib/legal";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Privacy policy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_li]:ml-4 [&_li]:list-disc">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <Link href="/">
        <Logo />
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="text-sm text-muted-foreground">Version of {formatDate(PRIVACY_VERSION)}</p>
      </div>

      <Section title="Who runs Tracker">
        <p>
          Tracker is a personal, non-commercial planning tool run by one person for themselves and a small group of
          invited friends. It is not a company and does not sell anything.
        </p>
      </Section>

      <Section title="What we collect">
        <ul>
          <li>Your email address and, if you use Google sign-in, your name from Google.</li>
          <li>
            What you choose to enter: your goals, the investments saving for them (names, values, SIPs), loan details
            for loan goals, planned payments for a bills fund, and your money plan amounts.
          </li>
          <li>
            For credit cards: the name you give each card, its fee, card year, rewards, benefits, spend milestones and
            the monthly bill amounts you log. Never the card number.
          </li>
          <li>
            From a statement you import: each fund&apos;s name, ISIN, category, value and SIP. Nothing else from the
            statement is kept.
          </li>
          <li>Your settings (theme, colour) and a record of what you agreed to and when.</li>
        </ul>
        <p>
          We never ask for bank account numbers, card numbers or passwords to your bank. Please don&apos;t type them
          into free-text fields.
        </p>
      </Section>

      <Section title="How it is used">
        <p>
          Only to show you your own goals, plans and progress. We do not sell, rent or share your data, show
          ads, or use it for marketing.
        </p>
      </Section>

      <Section title="Where it is stored">
        <ul>
          <li>
            Your data is stored in a Supabase database. Row-level security means each account can only read and write
            its own rows.
          </li>
          <li>The app is hosted on Vercel. Data is encrypted in transit (HTTPS).</li>
        </ul>
      </Section>

      <Section title="Importing a statement (optional)">
        <p>
          You can upload a Consolidated Account Statement (CAS) from CAMS, KFintech, NSDL or CDSL to update your
          investments.
        </p>
        <ul>
          <li>
            The PDF and its password are read on Tracker&apos;s server (hosted on Vercel) and thrown away straight
            after. Neither is stored or logged.
          </li>
          <li>
            Your name, PAN, address, email, phone, folio numbers and demat account numbers are dropped while reading
            and never reach the app or its database.
          </li>
          <li>
            Nothing is saved until you review it and tap save. You choose what updates, what is added and what is
            skipped.
          </li>
        </ul>
      </Section>

      <Section title="AI">
        <p>
          When a fund&apos;s category can&apos;t be worked out from its name, Tracker may ask AI models through
          OpenRouter. Only the fund&apos;s public scheme name is sent, never amounts, units, ISINs or anything about
          you. Two models must agree before an answer is used; otherwise you&apos;re asked to pick.
        </p>
        <p>
          <b>Ask</b> (off until you turn it on) answers questions about your own goals and investments. Each question
          sends the AI your question as you typed it, plus your goals and investments as codes (like &quot;Goal 1,
          wedding, ₹20L by 2030&quot;) with rounded amounts and kinds of funds. Goal names, nicknames and payment
          names you typed are replaced by codes and put back only on your screen. Your name, email, PAN, folio and
          account numbers are never sent. Chats aren&apos;t saved; only a count of questions is kept for the daily
          limit. You can turn Ask off in Settings.
        </p>
        <p>
          <b>Reading card features</b> uses the same switch as Ask. When you upload a card&apos;s features PDF or
          describe your card, its text is sent to two AI models (and a paid one if they disagree) to pull out the fee,
          rewards, benefits and milestones. Before anything is sent, card numbers, emails, phone numbers and PAN-like
          codes are masked. The PDF and text aren&apos;t kept. You check every result, and nothing is saved until you
          choose what to keep.
        </p>
        <p>
          Some free AI models may keep or learn from what they receive. Nothing sent identifies you, but don&apos;t
          type personal details into your questions.
        </p>
      </Section>

      <Section title="Automatic portfolio reviews">
        <p>Portfolio reviews are off until you turn them on separately in Portfolio. They also require AI to be on. After you confirm a CAS import, the app runs a full review. Other holding updates run basic checks and use AI only for a major change.</p>
        <p>Only anonymous codes, asset categories, rounded portfolio totals and app-calculated check types go to OpenRouter. Your names, account details, exact holding balances and CAS document are not sent for this review. AI prioritises calculated findings and cannot change your holdings or SIPs. The latest derived review and comparison snapshot are saved in your account. Turn off reviews in Portfolio to clear them. Deleting your account removes them.</p>
      </Section>

      <Section title="Cookies">
        <p>
          Tracker uses only essential cookies: one to keep you signed in and two to remember your theme and colour. No
          tracking or advertising cookies.
        </p>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Edit or remove any information at any time from Settings.</li>
          <li>
            Delete your account from Settings. This permanently removes every row of your data. It cannot be undone.
          </li>
        </ul>
        {contact ? (
          <p>
            Questions or data requests:{" "}
            <a href={`mailto:${contact}`} className="underline">
              {contact}
            </a>
            .
          </p>
        ) : (
          <p>Questions or data requests: contact the person who invited you.</p>
        )}
      </Section>

      <Section title="Not investment advice">
        <p>{DISCLAIMER}</p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, you will be asked to read and accept the new version before continuing to use
          Tracker.
        </p>
      </Section>
    </main>
  );
}
