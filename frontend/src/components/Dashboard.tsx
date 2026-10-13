'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Layers, ArrowRight, Lock, Unlock, Zap } from 'lucide-react';
import {
  DailySystemDesignRecord,
  DIFFICULTY_CONFIG,
  isResourcesUnlocked,
  fetchTodaySystemDesign,
  getISTTime,
} from '@/lib/systemDesign';

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

  const [submissions, setSubmissions]       = useState<any[]>([]);
  const [avatars, setAvatars]               = useState<Record<string, string>>({});
  const [displayNames, setDisplayNames]     = useState<Record<string, string>>({});
  const [userColors, setUserColors]         = useState<Record<string, string>>({});
  const [selectedSub, setSelectedSub]       = useState<any | null>(null);
  const [qotdMap, setQotdMap]               = useState<Record<string, any>>({});
  const [systemDesignMap, setSystemDesignMap] = useState<Record<string, DailySystemDesignRecord>>({});
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch QOTD first so we can map time-traveled submissions
        const qotdSnapshot = await getDocs(collection(db, 'qotd'));
        const qMap: Record<string, any> = {};
        const slugToQotdDate: Record<string, string> = {};
        qotdSnapshot.docs.forEach(d => {
          const data = d.data();
          qMap[d.id] = data;
          slugToQotdDate[data.titleSlug] = d.id;
        });
        setQotdMap(qMap);

        // 2. Fetch submissions
        const subSnap = await getDocs(collection(db, 'submissions'));
        const rawSubmissions = subSnap.docs.map(doc => {
          const data = doc.data();
          // Time Travel Feature: If this submission is a known QOTD, credit it to the QOTD's date
          // instead of the raw submission timestamp.
          if (slugToQotdDate[data.titleSlug]) {
            return { ...data, date: slugToQotdDate[data.titleSlug] };
          }
          return data;
        });

        // 3. Deduplicate: keep only the latest submission per user per question PER DAY to preserve streaks
        const uniqueSubs = new Map();
        for (const sub of rawSubmissions) {
          const key = `${sub.username}_${sub.titleSlug}_${sub.date}`;
          if (!uniqueSubs.has(key) || sub.timestamp > uniqueSubs.get(key).timestamp) {
            uniqueSubs.set(key, sub);
          }
        }
        setSubmissions(Array.from(uniqueSubs.values()));

        // 4. Fetch participants and users for avatars, display names, and theme colors
        const partSnap = await getDocs(collection(db, 'participants'));
        const avatarMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        const colorMap: Record<string, string> = {};

        partSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.username) {
            if (data.avatar) avatarMap[data.username] = data.avatar;
            if (data.displayName) nameMap[data.username] = data.displayName;
            if (data.themeColor) colorMap[data.username] = data.themeColor;
          }
        });

        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.username) {
            if (data.displayName && !nameMap[data.username]) nameMap[data.username] = data.displayName;
            if (data.themeColor && !colorMap[data.username]) colorMap[data.username] = data.themeColor;
          }
        });

        setAvatars(avatarMap);
        setDisplayNames(nameMap);
        setUserColors(colorMap);

        // 5. Fetch daily system design records
        try {
          const sdSnap = await getDocs(collection(db, 'system_design_daily'));
          const sdM: Record<string, DailySystemDesignRecord> = {};
          sdSnap.docs.forEach(d => {
            sdM[d.id] = d.data() as DailySystemDesignRecord;
          });
          const istToday = getISTTime().dateStr;
          if (!sdM[istToday]) {
            const todaySD = await fetchTodaySystemDesign();
            if (todaySD) sdM[todaySD.date] = todaySD;
          }
          setSystemDesignMap(sdM);
        } catch (e) {
          console.error('Failed to load system design in dashboard:', e);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter submissions for the currently selected date
  const daySubmissions = submissions.filter(s => s.date === selectedDate);
  const todayQotd = qotdMap[selectedDate];

  // Get the problem statement and title, prioritizing the QOTD
  const firstSubWithContext = daySubmissions.find(s => s.questionContext && (!todayQotd || s.titleSlug === todayQotd.titleSlug)) || daySubmissions.find(s => s.questionContext);
  const problemStatement = firstSubWithContext?.questionContext;
  const problemTitle = todayQotd?.title || firstSubWithContext?.title;

  if (!mounted) return null; // Avoid rendering until client-side hydration completes

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full min-w-0">
      <div className="w-full xl:w-[420px] xl:shrink-0 flex flex-col gap-6 items-center">
        <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <UserProgress submissions={submissions} avatars={avatars} qotdMap={qotdMap} />
      </div>
      <div className="flex-1 min-w-0 w-full flex flex-col gap-8">
        <Leaderboard 
          date={selectedDate} 
          daySubmissions={daySubmissions}
          avatars={avatars}
          displayNames={displayNames}
          userColors={userColors}
          qotdSlug={todayQotd?.titleSlug}
          loading={loading}
          onRowClick={(username) => {
            let sub;
            if (todayQotd) {
              sub = daySubmissions.find(s => s.username === username && s.titleSlug === todayQotd.titleSlug);
            }
            if (!sub) {
              sub = daySubmissions.find(s => s.username === username);
            }
            if (sub) setSelectedSub(sub);
          }}
        />

        {/* System Design Challenge of the Day */}
        {(() => {
          const istToday = getISTTime().dateStr;
          const sdRecord = systemDesignMap[selectedDate] || systemDesignMap[istToday];
          if (!sdRecord || !sdRecord.problems || sdRecord.problems.length === 0) return null;

          const sdProblem = sdRecord.problems[0];
          const sdUnlocked = isResourcesUnlocked(sdRecord.date);
          const sdDiff = DIFFICULTY_CONFIG[sdProblem.difficulty] || DIFFICULTY_CONFIG[0];

          return (
            <div className="w-full min-w-0 glass border border-white/10 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>System Design Challenge of the Day</span>
                  </span>
                  {sdRecord.isSunday && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      <Zap className="w-3 h-3 fill-amber-400" />
                      Sunday 2x
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${sdDiff.bgClass} ${sdDiff.borderClass} ${sdDiff.textClass}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sdDiff.color }} />
                    Diff {sdProblem.difficulty}: {sdDiff.label}
                  </span>
                </div>

                <div className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border self-start sm:self-auto ${
                  sdUnlocked
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  {sdUnlocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Solutions &amp; Tags Unlocked</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Unlocks at 6:00 PM IST</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span>Problem #{sdProblem.id}</span>
                  <span>•</span>
                  <span>{sdRecord.date} ({sdRecord.dayName})</span>
                </div>
                <h4 className="text-lg sm:text-xl font-black text-white group-hover:text-indigo-300 transition-colors">
                  {sdProblem.title}
                </h4>
                <p className="text-slate-300 text-sm line-clamp-2 leading-relaxed">
                  {sdProblem.problem_statement}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/5">
                <div className="text-xs text-slate-400">
                  {sdRecord.problems.length > 1 ? (
                    <span className="text-amber-300 font-medium">Sunday Arc: {sdRecord.problems.length} problems assigned today</span>
                  ) : (
                    <span>{sdUnlocked ? 'Full solution walkthroughs and articles available' : 'Spend the day designing components before 6 PM IST'}</span>
                  )}
                </div>

                <Link
                  href="/system-design"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-200 hover:text-white text-xs font-semibold border border-indigo-500/30 hover:border-indigo-500/50 transition-all shadow"
                >
                  <span>Explore Architecture Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })()}

        {problemStatement && problemStatement !== "No description available" && (
          <div className="w-full min-w-0 bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 text-white text-sm overflow-hidden">
            <h3 className="font-bold text-lg sm:text-xl mb-4 text-indigo-400 break-words">{problemTitle || 'Problem of the Day'}</h3>
            <div 
              className="leetcode-content max-h-[400px] overflow-y-auto overflow-x-auto text-slate-300 pr-2 custom-scrollbar max-w-full"
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
          userColors={userColors}
        />
      </AnimatePresence>
    </div>
  );
}
