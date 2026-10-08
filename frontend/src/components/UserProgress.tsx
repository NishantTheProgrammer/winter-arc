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

          // Extract unique topics covered by this user
          const topicsCovered = new Set<string>();
          submissions
            .filter(s => s.username === username)
            .forEach(s => {
              if (s.analysis && s.analysis.approachesUsed) {
                s.analysis.approachesUsed.forEach((approach: string) => {
                  // The approach is like "DSA / Hashing / Hash Map"
                  // Let's grab the last part for brevity
                  const parts = approach.split(' / ');
                  topicsCovered.add(parts[parts.length - 1]);
                });
              }
            });

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
              
              {/* Topics Covered */}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {Array.from(topicsCovered).map(topic => (
                  <span key={topic} className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
                    {topic}
                  </span>
                ))}
                {topicsCovered.size === 0 && (
                  <span className="text-[10px] text-slate-500 italic px-1">No topics covered yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
