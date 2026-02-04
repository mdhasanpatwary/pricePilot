/**
 * Terms of Service Page
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | PricePilot',
  description: 'PricePilot Terms of Service - Legal terms and conditions for using our service',
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using PricePilot (&quot;Service&quot;), you agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and PricePilot. We reserve the
            right to modify these Terms at any time. Continued use of the Service after changes constitutes
            acceptance of the modified Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p>
            PricePilot is a SaaS platform that provides e-commerce price intelligence and automated pricing
            management. The Service includes:
          </p>
          <ul>
            <li>Competitor price monitoring and scraping</li>
            <li>Product matching and comparison</li>
            <li>Automated price updates to your e-commerce store</li>
            <li>Analytics and reporting</li>
            <li>API access for integrations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
          <h3 className="text-xl font-semibold mb-3">3.1 Eligibility</h3>
          <p>
            You must be at least 18 years old and have the legal capacity to enter into contracts. By
            registering, you represent that you meet these requirements.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Account Security</h3>
          <p>You are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized access</li>
            <li>Using strong passwords and enabling multi-factor authentication</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">3.3 Account Information</h3>
          <p>
            You agree to provide accurate, current, and complete information during registration and to
            update such information to keep it accurate, current, and complete.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
          <h3 className="text-xl font-semibold mb-3">4.1 Permitted Use</h3>
          <p>You may use the Service only for lawful purposes and in accordance with these Terms.</p>

          <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Prohibited Activities</h3>
          <p>You agree NOT to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Transmit malware, viruses, or harmful code</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Use the Service to harm, harass, or threaten others</li>
            <li>Scrape or harvest data from the Service</li>
            <li>Reverse engineer or decompile the Service</li>
            <li>Resell or redistribute the Service without authorization</li>
            <li>Use the Service for competitive analysis of PricePilot</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Pricing and Payment</h2>
          <h3 className="text-xl font-semibold mb-3">5.1 Subscription Plans</h3>
          <p>
            The Service is offered on a subscription basis with different plan tiers. Current pricing is
            available on our website.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Billing</h3>
          <ul>
            <li>Subscriptions are billed in advance on a monthly or annual basis</li>
            <li>Payment is due immediately upon subscription</li>
            <li>We accept major credit cards and other payment methods</li>
            <li>All fees are non-refundable except as required by law</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">5.3 Price Changes</h3>
          <p>
            We reserve the right to change our pricing at any time. Price changes will be communicated
            at least 30 days in advance and will apply to subsequent billing periods.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">5.4 Cancellation</h3>
          <p>
            You may cancel your subscription at any time. Cancellation takes effect at the end of the
            current billing period. No refunds will be provided for partial periods.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Data and Privacy</h2>
          <h3 className="text-xl font-semibold mb-3">6.1 Your Data</h3>
          <p>
            You retain all rights to your data. We do not claim ownership of any data you upload or
            generate through the Service.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">6.2 Privacy Policy</h3>
          <p>
            Our collection and use of personal information is governed by our{' '}
            <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a>,
            which is incorporated into these Terms by reference.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">6.3 Data Security</h3>
          <p>
            We implement industry-standard security measures to protect your data. However, no method
            of transmission or storage is 100% secure. You use the Service at your own risk.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">6.4 Data Backup</h3>
          <p>
            While we perform regular backups, you are responsible for maintaining your own backups of
            critical data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
          <h3 className="text-xl font-semibold mb-3">7.1 Our Rights</h3>
          <p>
            The Service, including all software, designs, text, graphics, and other content, is owned
            by PricePilot and protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">7.2 License Grant</h3>
          <p>
            We grant you a limited, non-exclusive, non-transferable, revocable license to access and
            use the Service for your internal business purposes, subject to these Terms.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">7.3 Feedback</h3>
          <p>
            If you provide feedback, suggestions, or ideas about the Service, we may use them without
            any obligation to you.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Third-Party Services</h2>
          <p>
            The Service may integrate with third-party services (e.g., your e-commerce platform,
            payment processors). Your use of third-party services is subject to their respective
            terms and conditions.
          </p>
          <p>
            We are not responsible for the availability, accuracy, or content of third-party services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Disclaimers</h2>
          <h3 className="text-xl font-semibold mb-3">9.1 Service Availability</h3>
          <p>
            The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties of any kind. We do
            not guarantee uninterrupted or error-free operation.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">9.2 Accuracy</h3>
          <p>
            While we strive for accuracy, we do not guarantee that competitor data, price information,
            or product matches are always accurate or up-to-date.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">9.3 Business Decisions</h3>
          <p>
            You are solely responsible for your pricing decisions. We provide tools and data, but you
            make the final decisions about your prices.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PRICEPILOT SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS
            OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
          </p>
          <p>
            OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED
            THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless PricePilot from any claims, damages, losses, or
            expenses (including legal fees) arising from:
          </p>
          <ul>
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Your data or content</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
          <h3 className="text-xl font-semibold mb-3">12.1 By You</h3>
          <p>
            You may terminate your account at any time through your account settings or by contacting
            support.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">12.2 By Us</h3>
          <p>We may suspend or terminate your account if:</p>
          <ul>
            <li>You violate these Terms</li>
            <li>Your payment fails</li>
            <li>We are required to do so by law</li>
            <li>We discontinue the Service</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">12.3 Effect of Termination</h3>
          <p>
            Upon termination, your right to use the Service immediately ceases. We may delete your
            data in accordance with our data retention policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Dispute Resolution</h2>
          <h3 className="text-xl font-semibold mb-3">13.1 Governing Law</h3>
          <p>
            These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict
            of law principles.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">13.2 Arbitration</h3>
          <p>
            Any disputes arising from these Terms or the Service shall be resolved through binding
            arbitration, except where prohibited by law.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">13.3 Class Action Waiver</h3>
          <p>
            You agree to resolve disputes on an individual basis and waive any right to participate
            in class actions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. General Provisions</h2>
          <h3 className="text-xl font-semibold mb-3">14.1 Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between
            you and PricePilot.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">14.2 Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable, the remaining provisions
            will remain in full force and effect.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">14.3 Waiver</h3>
          <p>
            Our failure to enforce any right or provision of these Terms does not constitute a waiver
            of that right or provision.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">14.4 Assignment</h3>
          <p>
            You may not assign or transfer these Terms without our written consent. We may assign
            these Terms without restriction.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">15. Contact Information</h2>
          <p>If you have questions about these Terms, contact us:</p>
          <ul>
            <li><strong>Email:</strong> <a href="mailto:legal@pricepilot.com" className="text-primary hover:underline">legal@pricepilot.com</a></li>
            <li><strong>Support:</strong> <a href="mailto:support@pricepilot.com" className="text-primary hover:underline">support@pricepilot.com</a></li>
          </ul>
        </section>

        <div className="mt-12 p-6 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            By using PricePilot, you acknowledge that you have read, understood, and agree to be bound
            by these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
