'use client';

import dynamic from 'next/dynamic';

const Calendar = dynamic(() => import('./Calendar'), { ssr: false });
const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });

export default function Dashboard() {
  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
      <div className="w-full xl:w-auto flex justify-center">
        <Calendar />
      </div>
      <div className="flex-1 w-full">
        <Leaderboard />
      </div>
    </div>
  );
}
