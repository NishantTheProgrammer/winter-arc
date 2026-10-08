'use client';

import dynamic from 'next/dynamic';

import { useState } from 'react';

const Calendar = dynamic(() => import('./Calendar'), { ssr: false });
const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today, but lock to Winter Arc if we are out of range for some reason
    const today = new Date();
    if (today < new Date(2026, 9, 1)) return '2026-10-01';
    if (today > new Date(2026, 11, 31)) return '2026-12-31';
    return today.toISOString().split('T')[0];
  });

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
      <div className="w-full xl:w-auto flex justify-center">
        <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </div>
      <div className="flex-1 w-full">
        <Leaderboard date={selectedDate} />
      </div>
    </div>
  );
}
