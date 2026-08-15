import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — TAKSH",
  description: "How TAKSH collects, uses, and protects your information across the digital menu and ordering experience.",
};

const LAST_UPDATED = "August 15, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-[17px] text-[color:var(--brand-gold)]">{title}</h2>
      <div className="mt-2 space-y-3 text-[13.5px] leading-relaxed text-[color:var(--brand-gold-muted)]">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-sm px-4 pb-16">
        <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-background/95 px-4 py-4 backdrop-blur">
          <Link
            href="/menu"
            aria-label="Back to menu"
            className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)]/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-serif text-[19px] text-[color:var(--brand-gold-soft)]">Privacy Policy</h1>
        </div>

        <p className="mt-2 text-[12px] text-[color:var(--brand-gold-muted)]">Last updated: {LAST_UPDATED}</p>

        <p className="mt-4 text-[13.5px] leading-relaxed text-[color:var(--brand-gold-muted)]">
          This policy explains what information TAKSH collects when you browse our digital menu, place an order
          by scanning a table QR code, or interact with us as a guest, and how that information is used. By using
          this menu and ordering system, you agree to the practices described below.
        </p>

        <Section title="Information you provide">
          <p>When you place an order, we ask for your name and, optionally, a phone number.</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your name is used to identify your order at the table and on the kitchen ticket.</li>
            <li>Your phone number is optional and used only to reach you about your order if needed.</li>
            <li>If you opt in, we may send order or review-related messages over WhatsApp to that number.</li>
            <li>If you submit a review or rate a dish, we store the rating, review text, and the name you provide with it.</li>
          </ul>
        </Section>

        <Section title="Information collected automatically">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              An anonymous device/session identifier stored in your browser's local storage, used to remember your
              cart, your favourite dishes, and your language preference across visits.
            </li>
            <li>Your selected language (English, Hindi, or Marathi), saved locally on your device.</li>
            <li>
              Basic usage data such as menu views, dish views, and add-to-cart actions, used to understand which
              dishes are popular and to improve the menu. This is collected only on our live production site, never
              during local development or preview testing.
            </li>
            <li>Table and order session details — table number, order items, quantities, and timestamps.</li>
          </ul>
        </Section>

        <Section title="Push notifications">
          <p>
            If you allow notifications, we store a notification identifier (via OneSignal, or Firebase Cloud
            Messaging as a fallback) so we can send you a one-time prompt asking about your experience after your
            visit. You can decline this prompt at any time, and no notifications are sent without your permission.
          </p>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To take, prepare, and bill your order correctly.</li>
            <li>To remember your cart and preferences during your visit.</li>
            <li>To send an optional review request after your meal.</li>
            <li>To understand which dishes and categories guests enjoy, so we can improve the menu.</li>
            <li>To respond to reviews or feedback you choose to share.</li>
          </ul>
        </Section>

        <Section title="Payments">
          <p>
            We do not collect or process card or UPI payment details through this app. Bills are settled directly
            with restaurant staff at the counter, by cash, UPI, or card, using the restaurant's own payment
            channels.
          </p>
        </Section>

        <Section title="Sharing of information">
          <p>
            We do not sell your personal information. We share data only with the service providers that help us
            run this system — our database and hosting provider (Supabase), our hosting platform (Vercel), our
            image/CDN provider, and our notification providers (OneSignal / Firebase) — solely to operate the menu
            and ordering experience. Each provider processes data under its own privacy and security practices.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            Order, billing, and customer records are retained for standard business and accounting purposes.
            Anonymous usage analytics may be retained in aggregate to track trends over time. Reviews you choose to
            publish remain visible until removed by restaurant staff.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Phone number and WhatsApp opt-in are optional — you can order with just your name.</li>
            <li>You can decline push notifications at any time from your browser or device settings.</li>
            <li>You can ask restaurant staff to have your order or customer record removed.</li>
          </ul>
        </Section>

        <Section title="Children's privacy">
          <p>This menu and ordering system is not directed at children and is not knowingly used to collect information from children.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time as our systems evolve. The "Last updated" date above
            reflects the most recent revision.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            For questions about this policy or your information, please speak with restaurant staff at the counter,
            or use the contact details printed on your bill.
          </p>
        </Section>
      </div>
    </main>
  );
}
