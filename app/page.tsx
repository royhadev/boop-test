import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex flex-col">
      
      {/* Header simple */}
      <header className="w-full border-b bg-white/80 backdrop-blur-sm px-6 py-4 flex justify-between items-center">
        <div className="text-xl font-bold text-yellow-600">
          BOOP <span className="text-slate-800">Miniapp</span>
        </div>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/boop/mini" className="hover:text-yellow-600">
            Miniapp
          </Link>
          <Link href="/boop/mini/stake" className="hover:text-yellow-600">
            Stake
          </Link>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-6 py-12">

        <h1 className="text-4xl font-bold mb-4">
          Welcome to BOOP 👋
        </h1>

        <p className="text-lg text-slate-700 max-w-2xl text-center leading-relaxed mb-10">
          BOOP is a gamified Miniapp on the Base network powered by XP, Levels, Daily Missions, Seasonal Rewards, and social engagement through Farcaster.
          Our goal is to create a fun, rewarding, and sticky ecosystem for users.
        </p>

        {/* Project Status */}
        <section className="w-full max-w-2xl bg-white shadow-md rounded-2xl p-6 mb-8 border border-slate-200">
          <h2 className="text-xl font-semibold mb-2">Current Project Status</h2>
          <ul className="list-disc pl-6 text-slate-700 leading-relaxed">
            <li>Domain and official project email are ready.</li>
            <li>Farcaster account <strong>@boopapp</strong> is active.</li>
            <li>We are building the first version of the BOOP Miniapp.</li>
          </ul>
        </section>

        {/* Next Step */}
        <section className="w-full max-w-2xl bg-indigo-50 shadow-md rounded-2xl p-6 border border-indigo-200 text-slate-700">
          <h2 className="text-xl font-semibold mb-3">Next Step</h2>
          <p className="mb-4">
            Navigate to the Miniapp to start testing XP, Levels, Missions, and user data.
          </p>

          <Link
            href="/boop/mini"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            Go to Miniapp
          </Link>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-slate-500 text-sm">
        BOOP on Base · XP · Levels · Missions · Rewards
      </footer>
    </div>
  )
}
