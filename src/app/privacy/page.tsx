import { SiteHeader, SiteFooter } from "@/components/brand";
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader pathname="/privacy" />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="eyebrow mb-5 text-muted-foreground">
          Participation & privacy
        </p>
        <h1 className="mb-8 text-5xl">
          A shared tree.
          <br />
          Your choice to grow.
        </h1>
        <div className="space-y-7 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-2xl text-foreground">
              What becomes public
            </h2>
            <p>
              Your approved leaf, its theme, timestamp and suggested chamber
              appear on the tree and a public keepsake page. Anyone with that
              page's link can view it. Your leaf may contribute to a collective
              reflection. Participation is optional and anonymous; we do not ask
              for a name or contact details to submit a hope.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl text-foreground">
              Remembering a visit is optional
            </h2>
            <p>
              After submitting, you can choose to connect your voice to your
              11-digit CID and a private 6-digit PIN. The CID is stored only as
              a keyed lookup value; the PIN is salted and hashed. Neither is
              sent to OpenAI, displayed publicly or kept in browser storage.
              This is a private visit profile, not government identity
              verification. You need both values to unlock your linked notes and
              replies on a later visit. Staff cannot recover a forgotten PIN.
            </p>
            <p className="mt-3">
              A private session cookie lasts 12 hours. While signed in, new
              submissions are connected to your history. Sign out on shared
              devices. From your history you can remove your profile, its lookup
              value, PIN and history links; anonymous leaves and staff
              submission records remain. Private notes removed by staff are no
              longer available in your history.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl text-foreground">
              What happens to your words
            </h2>
            <p>
              When interpretation is enabled, your aspiration is sent to OpenAI
              for safety checks and interpretation, with response storage
              disabled in our generation requests. OpenAI processes that request
              under its own data policies. In offline mode we use local keyword
              matching and a curated sentence instead. With the consent you give
              before submitting, your original words are retained privately for
              staff review. Email addresses, phone-like numbers and links are
              redacted before the message is encrypted. Only the approved leaf
              is public. A personal reply to your note is stored privately for
              safe retries; it is never included in the public tree or keepsake.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl text-foreground">
              What stays on the host laptop
            </h2>
            <p>
              Approved leaves, encrypted private messages and moderation
              outcomes, anonymous request fingerprints for safe retries,
              short-lived rate-limit counters, staff action records and
              aggregate counts are stored in a local SQLite database. A signed
              anonymous browser cookie helps limit repeat submissions. Staff
              sign-in uses a separate cookie that expires after eight hours. The
              display caches approved leaves on its browser for up to one day to
              recover from outages. Your private reply and original note are
              also kept in this browser tab until you start another hope or
              close the tab. An unfinished form is kept in this browser tab's
              session storage so a refresh does not lose your draft. Staff can
              delete private words in the console; doing so also hides the
              linked public leaf. Older contributions created before private
              history was enabled do not have recoverable original words.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl text-foreground">
              Keep your hope anonymous
            </h2>
            <p>
              Please leave out names, addresses, phone numbers, emails, links
              and personal information. Submitted content is checked, but
              automated moderation has limits. Ask reception staff to remove a
              leaf if something should not be shared. Hidden leaves stop
              appearing in public reads and connected displays; a disconnected
              screen may show its last cached tree until it reconnects. A saved
              image or shared copy cannot be recalled.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl text-foreground">
              A hackathon experience
            </h2>
            <p>
              These are participating visitors' hopes, not official plans,
              commitments or representative survey results. Demo contributions
              are labelled. The local operator controls database retention and
              should clear demonstration data when the event ends.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
