import React from 'react';
import { motion } from 'framer-motion';

interface UserProgressProps {
  submissions: any[];
  avatars: Record<string, string>;
}

export default function UserProgress({ submissions, avatars }: UserProgressProps) {
  // Winter arc is Oct 1 to Dec 31, 2026
  const startDate = new Date(2026, 9, 1); // Oct 1
  const endDate = new Date(2026, 11, 31); // Dec 31
  const today = new Date();

  // Generate all 92 days
  const days: string[] = [];
  let d = new Date(startDate);
  while (d <= endDate) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
    d.setDate(d.getDate() + 1);
  }

  // Get unique usernames from avatars
  const usernames = Object.keys(avatars);

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white flex flex-col gap-5">
      <h3 className="font-bold text-lg text-slate-200">Winter Arc Progress</h3>
      
      <div className="flex flex-col gap-4">
        {usernames.map(username => {
          // Find all submission dates for this user
          const userSubDates = new Set(
            submissions
              .filter(s => s.username === username)
              .map(s => s.date)
          );

          return (
            <div key={username} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <img src={avatars[username]} alt={username} className="w-5 h-5 rounded-full object-cover border border-white/20" />
                {username}
              </div>
              <div className="flex gap-[2px]">
                {days.map((dateStr, idx) => {
                  const dateObj = new Date(dateStr);
                  const isFuture = dateObj > today;
                  const submitted = userSubDates.has(dateStr);

                  let bgColor = 'bg-white/5'; // future or unstarted
                  if (!isFuture) {
                    bgColor = submitted ? 'bg-emerald-500' : 'bg-rose-500';
                  }

                  return (
                    <div 
                      key={dateStr}
                      title={`${dateStr}: ${submitted ? 'Submitted' : isFuture ? 'Upcoming' : 'Missed'}`}
                      className={`h-4 flex-1 rounded-[1px] ${bgColor} opacity-80 hover:opacity-100 transition-opacity`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
