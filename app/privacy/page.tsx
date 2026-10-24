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
            What you choose to enter: age, city type, household, income, expenses, insurance, loans, savings,
            investments and goals. Almost everything is optional.
          </li>
          <li>Your settings (theme, colour) and a record of what you agreed to and when.</li>
          <li>A count of AI explanation requests (time and model used, never the content) to enforce daily limits.</li>
        </ul>
        <p>
          We never ask for bank account numbers, card numbers, passwords to your bank, or your PAN. Please don&apos;t
          type them into free-text fields.
        </p>
      </Section>

      <Section title="How it is used">
        <p>
          Only to show you your own budget, priorities and goal plans. We do not sell, rent or share your data, show
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

      <Section title="AI explanations (optional)">
        <p>
          AI explanations are off until you turn them on. When on, Tracker sends a short summary to OpenRouter, which
          passes it to an AI model provider, to write a plain-language explanation.
        </p>
        <ul>
          <li>
            The summary contains only rounded numbers that Tracker has already worked out (for example &quot;gap ₹2.4
            lakh, step: emergency fund&quot;) and general labels like &quot;retirement&quot;.
          </li>
          <li>
            It never includes your name, email, age, date of birth, city, goal names you typed, or the names of funds
            or institutions you hold.
          </li>
          <li>
            Some free AI models may keep or learn from what they receive. Because only anonymised numbers are sent,
            nothing in it identifies you.
          </li>
        </ul>
        <p>You can turn AI explanations off at any time in Settings.</p>
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
          <li>Withdraw AI consent at any time; nothing further is sent.</li>
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
