import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-xl font-bold">PRAL DI POS Platform</div>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-slate-300 hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="text-sm text-slate-300 hover:text-white">
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold mb-6 bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">
            PRAL Digital Invoicing POS for Every Business in Pakistan
          </h1>
          <p className="text-xl text-slate-400 mb-8">
            Multi-tenant point-of-sale system with automatic PRAL DI invoice submission, HS code management, and real-time compliance tracking. Set up your business in minutes.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium text-lg"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="border border-slate-600 hover:border-slate-500 text-white px-8 py-3 rounded-lg font-medium text-lg"
            >
              View Pricing
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          {[
            {
              title: 'PRAL DI Integration',
              description:
                'Automatic invoice submission to PRAL Digital Invoicing with queue-based retry, circuit breaker protection, and offline resilience.',
              icon: '📡',
            },
            {
              title: 'Multi-Tenant',
              description:
                'Each business gets isolated data, their own IRIS security tokens, staff accounts, and products — all on shared infrastructure.',
              icon: '🏢',
            },
            {
              title: 'HS Code Library',
              description:
                'Platform-managed HS code catalogue with 6,800+ codes. Map products to correct tax rates effortlessly.',
              icon: '📋',
            },
            {
              title: 'POS Terminal',
              description:
                'Fast, responsive point-of-sale interface with product search, cart management, and one-click invoicing.',
              icon: '🖥️',
            },
            {
              title: 'Real-time Dashboard',
              description:
                'Track sales, DI submission status, queue health, and business analytics at a glance.',
              icon: '📊',
            },
            {
              title: 'Encrypted Credentials',
              description:
                'IRIS security tokens encrypted with AES-256-GCM at rest. Per-tenant isolation ensures your data stays yours.',
              icon: '🔒',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-6"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-24 py-8 text-center text-sm text-slate-500">
        <p>PRAL DI POS Platform — Pakistan GST Compliance Made Simple</p>
      </footer>
    </div>
  )
}
