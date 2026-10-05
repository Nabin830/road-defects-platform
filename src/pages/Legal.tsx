import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo';

const UPDATED = '24 September 2026';

function LegalShell({ label, title, intro, children }: { label: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="w-full max-w-[760px] mx-auto px-6 py-10">
      <span className="section-label">{label}</span>
      <h1 className="mt-1 mb-2">{title}</h1>
      <p className="text-muted mb-1">{intro}</p>
      <p className="text-[12.5px] text-muted mb-8">Last updated {UPDATED}</p>
      <div className="card p-6 md:p-8 space-y-7 text-[14.5px] leading-relaxed text-ink-2 [&_h2]:text-[18px] [&_h2]:text-ink [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </main>
  );
}

export function PrivacyPage() {
  useSeo({ title: 'Privacy policy', description: 'How RoadFix collects, uses and protects your information when you report road defects in Orange, NSW.' });
  return (
    <LegalShell label="Privacy" title="Privacy policy"
                intro="What RoadFix collects, why, and who can see it. We only collect what we need to get roads fixed.">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><b>Your account:</b> name, email address (used only as your sign-in name — RoadFix doesn't send you emails), and optionally your phone number and suburb.</li>
          <li><b>Your reports:</b> the title, description, defect type, severity, photo, map location and street address you submit.</li>
          <li><b>Activity:</b> reports you back or follow, and the in-app notifications sent to you.</li>
          <li><b>Contractors:</b> company name and the updates, notes and photos posted on assigned jobs.</li>
        </ul>
      </section>
      <section>
        <h2>What is public</h2>
        <p>
          Reports appear on the public map so residents can see what has already been reported. The public can see a
          report's title, description, photo, location, status and repair timeline. <b>Your name, email, phone number
          and home suburb are never shown publicly.</b> Please don't include personal details, faces or number plates
          in photos or descriptions.
        </p>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To assess, prioritise, assign and track road repairs.</li>
          <li>To tell you in the app when a report you made or follow is updated.</li>
          <li>To produce council performance reports (counts and timeframes, not personal details).</li>
          <li>To prevent spam and misuse, for example limiting how many reports one account sends per day.</li>
        </ul>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li><b>Council staff</b> who manage road maintenance.</li>
          <li><b>The contractor assigned to a job</b>, who sees the report details they need to fix it.</li>
          <li><b>Service providers</b> that run the platform: our database and file storage host, and OpenStreetMap,
            which supplies map images and turns map locations into street addresses. When you use location or address
            search, the coordinates or text you enter are sent to OpenStreetMap to look them up.</li>
        </ul>
        <p className="mt-2">We don't sell your information or use it for advertising.</p>
      </section>
      <section>
        <h2>Storage and security</h2>
        <p>
          Data is stored with our hosting provider and protected by sign-in and access rules, so residents,
          contractors and council staff only see what their role allows. Your browser also stores your sign-in session
          and display preferences (such as dark mode) on your device.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Update your name, phone and suburb any time on your <Link to="/profile">profile</Link>.</li>
          <li>Ask council to see, correct or delete your personal information. Reports needed for maintenance records
            may be kept with your personal details removed.</li>
          <li>You can use the public map without an account.</li>
        </ul>
      </section>
      <section>
        <h2>Contact</h2>
        <p>For privacy questions or complaints, contact Orange City Council's customer service team and ask for the privacy officer.</p>
      </section>
    </LegalShell>
  );
}

export function TermsPage() {
  useSeo({ title: 'Terms of use', description: 'The rules for using RoadFix to report road defects to Orange City Council.' });
  return (
    <LegalShell label="Terms" title="Terms of use"
                intro="The rules for using RoadFix. By creating an account you agree to them.">
      <section>
        <h2>Not for emergencies</h2>
        <p>
          RoadFix is for non-urgent road defects. <b>If there is immediate danger to life or property, call 000.</b> For
          urgent hazards such as a collapsed road, fallen tree or major flooding, also phone council directly.
        </p>
      </section>
      <section>
        <h2>Reporting</h2>
        <ul>
          <li>Reports must be genuine, accurate and about public roads in the council area.</li>
          <li>Don't submit abusive, offensive or misleading content, or photos of people or number plates.</li>
          <li>Stay safe: never stand on the road to take a photo.</li>
          <li>Council may edit, re-grade, merge or reject reports, and may suspend accounts that misuse the service.</li>
        </ul>
      </section>
      <section>
        <h2>Timeframes</h2>
        <p>
          Target repair times (for example "3–5 days" for high-severity defects) are goals, not guarantees. Weather, safety,
          materials and scheduling can affect when work happens. Council sets a fix-by date when it assigns a job.
        </p>
      </section>
      <section>
        <h2>Contractors</h2>
        <p>
          Contractors must only post accurate updates and photos about work actually done, keep job details confidential,
          and follow all work health and safety and traffic management requirements. Council verifies completed repairs.
        </p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You keep ownership of photos and text you submit, and you allow council to use them to manage repairs and to show
          them on the public map and in council reports.
        </p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>
          We aim to keep RoadFix running but can't promise it will always be available or error-free. Map and address data
          comes from OpenStreetMap contributors and may not be exact, so check the pin before submitting.
        </p>
      </section>
      <section>
        <h2>More</h2>
        <p>See the <Link to="/privacy">privacy policy</Link> for how your information is handled.</p>
      </section>
    </LegalShell>
  );
}
