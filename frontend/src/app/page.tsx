import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mb-6 sm:mb-8">
        <h1
          className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
        >
          Dashboard
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Today's LeetCode challenge overview &amp; rankings</p>
      </div>
      <Dashboard />
    </div>
  );
}
