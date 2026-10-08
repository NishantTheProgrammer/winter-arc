'use client';

import dynamic from 'next/dynamic';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { AnimatePresence } from 'framer-motion';

const Calendar = dynamic(() => import('./Calendar'), { ssr: false });
const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });
const SubmissionModal = dynamic(() => import('./SubmissionModal'), { ssr: false });
const UserProgress = dynamic(() => import('./UserProgress'), { ssr: false });

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState('2026-10-01');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    if (today < new Date(2026, 9, 1)) {
      setSelectedDate('2026-10-01');
    } else if (today > new Date(2026, 11, 31)) {
      setSelectedDate('2026-12-31');
    } else {
      setSelectedDate(today.toISOString().split('T')[0]);
    }
  }, []);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Fetch submissions
      const subSnap = await getDocs(collection(db, 'submissions'));
      const rawSubmissions = subSnap.docs.map(doc => doc.data());

      // Deduplicate: keep only the latest submission per user per question
      const uniqueSubs = new Map();
      for (const sub of rawSubmissions) {
        const key = `${sub.username}_${sub.titleSlug}`;
        if (!uniqueSubs.has(key) || sub.timestamp > uniqueSubs.get(key).timestamp) {
          uniqueSubs.set(key, sub);
        }
      }
      setSubmissions(Array.from(uniqueSubs.values()));

      // Fetch participants for avatars
      const partSnap = await getDocs(collection(db, 'participants'));
      const avatarMap: Record<string, string> = {};
      partSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.username && data.avatar) {
          avatarMap[data.username] = data.avatar;
        }
      });
      setAvatars(avatarMap);
    }
    fetchData();
  }, []);

  // Filter submissions for the currently selected date
  const daySubmissions = submissions.filter(s => s.date === selectedDate);
  // Get the problem statement and title from any submission on this day (assuming 1 problem/day)
  const firstSubWithContext = daySubmissions.find(s => s.questionContext);
  const problemStatement = firstSubWithContext?.questionContext;
  const problemTitle = firstSubWithContext?.title;

  if (!mounted) return null; // Avoid rendering until client-side hydration completes

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
      <div className="w-full xl:w-[420px] flex flex-col gap-6 items-center">
        <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <UserProgress submissions={submissions} avatars={avatars} />
      </div>
      <div className="flex-1 w-full flex flex-col gap-8">
        <Leaderboard 
          date={selectedDate} 
          daySubmissions={daySubmissions}
          avatars={avatars}
          onRowClick={(username) => {
            const sub = daySubmissions.find(s => s.username === username);
            if (sub) setSelectedSub(sub);
          }}
        />

        {problemStatement && problemStatement !== "No description available" && (
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm">
            <h3 className="font-bold text-xl mb-4 text-indigo-400">{problemTitle || 'Problem of the Day'}</h3>
            <div 
              className="leetcode-content max-h-[400px] overflow-y-auto text-slate-300 pr-2 custom-scrollbar"
              dangerouslySetInnerHTML={{ __html: problemStatement }}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        <SubmissionModal 
          selectedSub={selectedSub} 
          setSelectedSub={setSelectedSub} 
          submissions={submissions} 
          avatars={avatars} 
        />
      </AnimatePresence>
    </div>
  );
}
