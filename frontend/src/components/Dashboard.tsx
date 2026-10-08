'use client';

import dynamic from 'next/dynamic';

const Calendar = dynamic(() => import('./Calendar'), { ssr: false });
const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });

export default function Dashboard() {
  return (
    <div className="flex flex-col md:flex-row gap-8 justify-center items-start mt-8 w-full">
      <div className="w-full md:w-1/3 flex justify-center">
        <Calendar />
      </div>
      <div className="w-full md:w-2/3 flex justify-center">
        <Leaderboard />
      </div>
    </div>
  );
}
