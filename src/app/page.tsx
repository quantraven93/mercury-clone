import Link from "next/link";
import {
  Scale,
  Bell,
  Calendar,
  Search,
  Zap,
  Shield,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-indigo-400" />
            <span className="text-xl font-bold">Mercury</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-sm text-indigo-300 mb-6">
          <Zap className="w-4 h-4" />
          Free. Open Source. Auto-updating every 30 minutes.
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight">
          Track Your Court Cases
          <br />
          <span className="text-indigo-400">Across All Indian Courts</span>
        </h1>
        <p className="text-lg text-slate-400 mt-6 max-w-2xl mx-auto">
          Monitor cases in the Supreme Court, High Courts, District Courts,
          NCLT, and Consumer Forums. Get instant alerts when your case status
          changes via Telegram and Email.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-lg transition-colors"
          >
            Start Tracking
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl text-lg transition-colors"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need to track litigation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Bell className="w-6 h-6" />}
            title="Instant Alerts"
            description="Get notified via Telegram and Email the moment your case status changes, a new order is uploaded, or a hearing date is updated."
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Calendar View"
            description="See all your upcoming hearings in a clean calendar view. Never miss a court date again."
          />
          <FeatureCard
            icon={<Search className="w-6 h-6" />}
            title="Party Name Search"
            description="Search across all Indian courts by party name. Find and track any case instantly."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Auto-Updates Every 30 Min"
            description="Your cases are checked automatically every 30 minutes. No manual refreshing needed."
          />
          <FeatureCard
            icon={<Scale className="w-6 h-6" />}
            title="All Courts Covered"
            description="Supreme Court, all High Courts, District Courts, NCLT, and Consumer Forums - all in one place."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Secure & Private"
            description="Your data is protected with row-level security. Only you can see your tracked cases."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl p-12">
          <h2 className="text-3xl font-bold">Ready to track your cases?</h2>
          <p className="text-slate-400 mt-3">
            Sign up for free. No credit card required.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-lg transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>Mercury Case Tracker - Open Source Indian Court Case Monitoring</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="p-3 bg-indigo-500/10 rounded-lg w-fit text-indigo-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
