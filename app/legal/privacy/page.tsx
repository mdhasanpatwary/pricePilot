/**
 * Privacy Policy Page
 * 
 * GDPR-compliant privacy policy
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | PricePilot',
  description: 'PricePilot Privacy Policy - How we collect, use, and protect your data',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Welcome to PricePilot. We respect your privacy and are committed to protecting your personal data.
            This privacy policy explains how we collect, use, disclose, and safeguard your information when you
            use our service.
          </p>
          <p>
            This policy complies with the General Data Protection Regulation (GDPR), California Consumer Privacy
            Act (CCPA), and other applicable data protection laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

          <h3 className="text-xl font-semibold mb-3">2.1 Information You Provide</h3>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, company name, password</li>
            <li><strong>Integration Data:</strong> Website URLs, API tokens for your e-commerce platforms</li>
            <li><strong>Product Data:</strong> Product information from your connected stores</li>
            <li><strong>Payment Information:</strong> Processed securely through our payment provider (we do not store credit card details)</li>
            <li><strong>Communications:</strong> Messages you send to our support team</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Information We Collect Automatically</h3>
          <ul>
            <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the platform</li>
            <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
            <li><strong>Cookies:</strong> Session cookies for authentication and functionality</li>
            <li><strong>Log Data:</strong> Server logs, error reports, performance metrics</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Information from Third Parties</h3>
          <ul>
            <li><strong>Competitor Data:</strong> Publicly available product and pricing information from competitor websites</li>
            <li><strong>OAuth Providers:</strong> If you sign in with Google or other providers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
          <p>We use your information for the following purposes:</p>
          <ul>
            <li><strong>Service Delivery:</strong> To provide and maintain our price monitoring and management service</li>
            <li><strong>Product Matching:</strong> To match your products with competitor products</li>
            <li><strong>Price Updates:</strong> To update prices on your connected stores</li>
            <li><strong>Analytics:</strong> To analyze usage patterns and improve our service</li>
            <li><strong>Communications:</strong> To send service updates, notifications, and support responses</li>
            <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security incidents</li>
            <li><strong>Legal Compliance:</strong> To comply with legal obligations and enforce our terms</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing (GDPR)</h2>
          <p>We process your personal data based on the following legal grounds:</p>
          <ul>
            <li><strong>Contract Performance:</strong> Processing necessary to provide our service</li>
            <li><strong>Legitimate Interests:</strong> Improving our service, security, and fraud prevention</li>
            <li><strong>Consent:</strong> Marketing communications (you can opt out anytime)</li>
            <li><strong>Legal Obligation:</strong> Compliance with laws and regulations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
          <p>We do not sell your personal data. We may share your information with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Cloud hosting, email delivery, payment processing</li>
            <li><strong>Your E-commerce Platform:</strong> To sync product and price data</li>
            <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
          <p>We implement industry-standard security measures to protect your data:</p>
          <ul>
            <li><strong>Encryption:</strong> Data encrypted in transit (TLS 1.3) and at rest (AES-256-GCM)</li>
            <li><strong>Access Controls:</strong> Role-based access, multi-factor authentication</li>
            <li><strong>Monitoring:</strong> 24/7 security monitoring and incident response</li>
            <li><strong>Regular Audits:</strong> Security assessments and penetration testing</li>
            <li><strong>Secure Development:</strong> Security-first development practices</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
          <p>We retain your data for as long as necessary to provide our service and comply with legal obligations:</p>
          <ul>
            <li><strong>Account Data:</strong> While your account is active</li>
            <li><strong>Product Data:</strong> While your account is active</li>
            <li><strong>Price History:</strong> 90 days (then archived)</li>
            <li><strong>Audit Logs:</strong> 2 years (then anonymized)</li>
            <li><strong>Financial Records:</strong> As required by law (typically 7 years)</li>
          </ul>
          <p>
            After account deletion, we retain minimal data for legal compliance and fraud prevention.
            See our <a href="/legal/data-retention" className="text-primary hover:underline">Data Retention Policy</a> for details.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Your Rights (GDPR)</h2>
          <p>Under GDPR, you have the following rights:</p>
          <ul>
            <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
            <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Right to Erasure:</strong> Request deletion of your data (&quot;right to be forgotten&quot;)</li>
            <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
            <li><strong>Right to Data Portability:</strong> Receive your data in a machine-readable format</li>
            <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for marketing communications</li>
            <li><strong>Right to Lodge a Complaint:</strong> File a complaint with your data protection authority</li>
          </ul>
          <p>
            To exercise these rights, visit your <a href="/dashboard/settings/privacy" className="text-primary hover:underline">Privacy Settings</a> or
            contact us at <a href="mailto:privacy@pricepilot.com" className="text-primary hover:underline">privacy@pricepilot.com</a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. California Privacy Rights (CCPA)</h2>
          <p>California residents have additional rights under CCPA:</p>
          <ul>
            <li><strong>Right to Know:</strong> What personal information we collect and how we use it</li>
            <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
            <li><strong>Right to Opt-Out:</strong> Opt out of the sale of personal information (we do not sell data)</li>
            <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Cookies and Tracking</h2>
          <p>We use cookies and similar technologies for:</p>
          <ul>
            <li><strong>Essential Cookies:</strong> Authentication, security, and core functionality</li>
            <li><strong>Analytics Cookies:</strong> Understanding usage patterns and improving our service</li>
            <li><strong>Preference Cookies:</strong> Remembering your settings and preferences</li>
          </ul>
          <p>
            You can control cookies through your browser settings. Note that disabling essential cookies may
            affect service functionality.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. International Data Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries outside your country of residence.
            We ensure appropriate safeguards are in place, including:
          </p>
          <ul>
            <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
            <li>Adequacy decisions for data transfers to approved countries</li>
            <li>Binding Corporate Rules for intra-group transfers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Children&apos;s Privacy</h2>
          <p>
            Our service is not intended for children under 16 years of age. We do not knowingly collect
            personal information from children. If you believe we have collected information from a child,
            please contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of significant changes
            via email or through our service. Your continued use of the service after changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Contact Us</h2>
          <p>If you have questions about this privacy policy or our data practices, contact us:</p>
          <ul>
            <li><strong>Email:</strong> <a href="mailto:privacy@pricepilot.com" className="text-primary hover:underline">privacy@pricepilot.com</a></li>
            <li><strong>Data Protection Officer:</strong> <a href="mailto:dpo@pricepilot.com" className="text-primary hover:underline">dpo@pricepilot.com</a></li>
            <li><strong>Support:</strong> <a href="mailto:support@pricepilot.com" className="text-primary hover:underline">support@pricepilot.com</a></li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">15. Supervisory Authority</h2>
          <p>
            If you are located in the European Economic Area (EEA), you have the right to lodge a complaint
            with your local data protection authority. You can find your authority at:{' '}
            <a
              href="https://edpb.europa.eu/about-edpb/board/members_en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://edpb.europa.eu/about-edpb/board/members_en
            </a>
          </p>
        </section>

        <div className="mt-12 p-6 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            This privacy policy is effective as of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} and
            applies to all users of PricePilot.
          </p>
        </div>
      </div>
    </div>
  );
}
