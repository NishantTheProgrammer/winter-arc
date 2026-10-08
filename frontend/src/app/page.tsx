import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <main className="min-h-screen p-8 md:p-24 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col gap-12">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm">
            Winter Arc Challenge
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-medium tracking-wide">
            Daily LeetCode Tracker &amp; AI Analysis
          </p>
        </div>

        {/* Dashboard Grid */}
        <Dashboard />

      </div>
    </main>
  );
}
