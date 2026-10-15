'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Layers, ArrowRight, Lock, Unlock, Zap, Clock, Code2, ExternalLink, Copy, Check, Percent } from 'lucide-react';
import {
  DailySystemDesignRecord,
  DIFFICULTY_CONFIG,
  isResourcesUnlocked,
  fetchTodaySystemDesign,
  getISTTime,
  findBackfillForDate,
  MISSED_DATES,
  FEATURE_KICKOFF_DATE,
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
  const [dashboardSdIndex, setDashboardSdIndex] = useState<number>(0);
  const [loading, setLoading]               = useState(true);
  const [qotdLoading, setQotdLoading]       = useState(false);
  const [copiedAnnouncement, setCopiedAnnouncement] = useState(false);

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

  // Fetch QOTD via API route if selected date is missing full data/content
  useEffect(() => {
    const istToday = getISTTime().dateStr;
    const isFuture = selectedDate > istToday;
    const currentQotd = qotdMap[selectedDate];

    if (!isFuture && (!currentQotd || !currentQotd.content || currentQotd.content === 'No description available')) {
      let isCancelled = false;
      setQotdLoading(true);

      fetch(`/api/qotd?date=${selectedDate}`)
        .then(res => res.json())
        .then(json => {
          if (!isCancelled && json.success && json.data) {
            setQotdMap(prev => ({
              ...prev,
              [selectedDate]: json.data,
            }));
          }
        })
        .catch(err => {
          console.warn('Failed to fetch QOTD via API route:', err);
        })
        .finally(() => {
          if (!isCancelled) setQotdLoading(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [selectedDate, qotdMap]);

  // Filter submissions for the currently selected date
  const daySubmissions = submissions.filter(s => s.date === selectedDate);
  const todayQotd = qotdMap[selectedDate];

  // Get problem statement, title, and metadata prioritizing QOTD
  const firstSubWithContext = daySubmissions.find(s => s.questionContext && (!todayQotd || s.titleSlug === todayQotd.titleSlug)) || daySubmissions.find(s => s.questionContext);
  const problemStatement = todayQotd?.content || firstSubWithContext?.questionContext;
  const problemTitle = todayQotd?.title || firstSubWithContext?.title;
  const problemSlug = todayQotd?.titleSlug || firstSubWithContext?.titleSlug;
  const problemDifficulty = todayQotd?.difficulty || firstSubWithContext?.difficulty || 'Medium';
  const problemAcRate = typeof todayQotd?.acRate === 'number'
    ? `${todayQotd.acRate.toFixed(1)}%`
    : (typeof firstSubWithContext?.acRate === 'number' ? `${firstSubWithContext.acRate.toFixed(1)}%` : null);
  const problemId = todayQotd?.questionFrontendId || firstSubWithContext?.questionFrontendId;
  const problemTags = todayQotd?.topicTags || [];
  const problemLink = todayQotd?.link || (problemSlug ? `https://leetcode.com/problems/${problemSlug}/` : null);

  // Format daily group announcement matching the user's WhatsApp post format
  const getDailyAnnouncementText = () => {
    // 1. Calculate Day Number from ARC start 2026-10-01
    const [y, m, d] = selectedDate.split('-').map(Number);
    const start = new Date(2026, 9, 1);
    const current = new Date(y, m - 1, d);
    const diffTime = current.getTime() - start.getTime();
    const dayNumber = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // 2. Leetcode section
    const diff = problemDifficulty || 'Medium';
    const lcUrl = problemLink || (problemSlug ? `https://leetcode.com/problems/${problemSlug}` : '');

    // 3. System design section
    const sdRecord = systemDesignMap[selectedDate];
    let sdSection = '';

    if (sdRecord && sdRecord.problems && sdRecord.problems.length > 0) {
      if (sdRecord.problems.length === 1) {
        const p = sdRecord.problems[0];
        sdSection = `\n\nSystem design: ${p.title}\n\n${p.problem_statement}`;
      } else {
        const titles = sdRecord.problems.map(p => p.title).join(' & ');
        const details = sdRecord.problems.map((p, idx) => `Problem ${idx + 1} (${p.title}):\n${p.problem_statement}`).join('\n\n');
        sdSection = `\n\nSystem design: ${titles}\n\n${details}`;
      }
    } else {
      const backfillStatus = findBackfillForDate(selectedDate, Object.values(systemDesignMap));
      if (backfillStatus.isBackfilled && backfillStatus.problem) {
        sdSection = `\n\nSystem design: ${backfillStatus.problem.title}\n\n${backfillStatus.problem.problem_statement}`;
      }
    }

    return `Day ${dayNumber}: ${diff}\n\nLeetcode:\n${lcUrl}${sdSection}`;
  };

  const handleCopyAnnouncement = async () => {
    try {
      const text = getDailyAnnouncementText();
      await navigator.clipboard.writeText(text);
      setCopiedAnnouncement(true);
      setTimeout(() => setCopiedAnnouncement(false), 2500);
    } catch (e) {
      console.error('Failed to copy announcement to clipboard:', e);
    }
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setDashboardSdIndex(0);
  };

  if (!mounted) return null; // Avoid rendering until client-side hydration completes

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start w-full min-w-0">
      <div className="w-full xl:w-[420px] xl:shrink-0 flex flex-col gap-6 items-center">
        <Calendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />
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
          qotdTitle={todayQotd?.title || firstSubWithContext?.title}
          qotdDifficulty={problemDifficulty}
          qotdAcRate={problemAcRate}
          onCopyAnnouncement={handleCopyAnnouncement}
          copiedAnnouncement={copiedAnnouncement}
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

        {/* System Design Challenge for the selected date */}
        {(() => {
          const istToday = getISTTime().dateStr;
          const sdRecord = systemDesignMap[selectedDate];
          const isSelectedToday = selectedDate === istToday;
          const isFuture = selectedDate > istToday;

          // 1. Future Dates
          if (isFuture) {
            return (
              <div className="w-full min-w-0 glass border border-white/10 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>System Design Challenge</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-mono">
                    {selectedDate}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-slate-300 text-sm">
                  <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-white text-sm">Upcoming System Design Problem</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      The challenge for {selectedDate} will be assigned on this date as per the Winter Arc schedule.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          // 2. Missed dates before feature kickoff
          const backfillStatus = findBackfillForDate(selectedDate, Object.values(systemDesignMap));
          if (backfillStatus.isMissedDate && !sdRecord) {
            if (backfillStatus.isBackfilled && backfillStatus.problem && backfillStatus.assignedOnSunday) {
              const bp = backfillStatus.problem;
              const bDiff = DIFFICULTY_CONFIG[bp.difficulty] || DIFFICULTY_CONFIG[0];
              return (
                <div className="w-full min-w-0 glass border border-purple-500/30 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                        <Zap className="w-3.5 h-3.5 fill-purple-400" />
                        <span>Sunday Backfill for {selectedDate}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                        Assigned on Sunday, {backfillStatus.assignedOnSunday}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${bDiff.bgClass} ${bDiff.borderClass} ${bDiff.textClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bDiff.color }} />
                        Diff {bp.difficulty}: {bDiff.label}
                      </span>
                    </div>

                    <div className="px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unlocked</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>Problem #{bp.id}</span>
                      <span>•</span>
                      <span>Assigned to catch up {selectedDate}</span>
                    </div>
                    <h4 className="text-lg sm:text-xl font-black text-white group-hover:text-purple-300 transition-colors">
                      {bp.title}
                    </h4>
                    <p className="text-slate-300 text-sm line-clamp-2 leading-relaxed">
                      {bp.problem_statement}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/5">
                    <div className="text-xs text-slate-400">
                      <span>Backfilled on Sunday ({backfillStatus.assignedOnSunday}) to catch up missed dates</span>
                    </div>

                    <Link
                      href={`/system-design?date=${backfillStatus.assignedOnSunday}`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 hover:text-white text-xs font-semibold border border-purple-500/30 hover:border-purple-500/50 transition-all shadow"
                    >
                      <span>View on Sunday Arc</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            } else {
              const dayNum = parseInt(selectedDate.split('-')[2], 10);
              return (
                <div className="w-full min-w-0 glass border border-amber-500/20 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden">
                  <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-semibold">
                      <Zap className="w-3.5 h-3.5 fill-amber-400" />
                      <span>Scheduled for Sunday Catch-Up</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-mono">
                      {selectedDate} (Day {dayNum})
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3.5 text-slate-300 text-sm">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">Catch-Up Scheduled on Upcoming Sunday</h5>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        This date preceded the System Design Arc kickoff. Each upcoming Sunday features 2 problems (1 regular + 1 catch-up) to backfill missed days in sequence!
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          }

          if (!sdRecord || !sdRecord.problems || sdRecord.problems.length === 0) return null;

          const currentIdx = Math.min(dashboardSdIndex, sdRecord.problems.length - 1);
          const sdProblem = sdRecord.problems[currentIdx] || sdRecord.problems[0];
          const sdUnlocked = isResourcesUnlocked(sdRecord.date);
          const sdDiff = DIFFICULTY_CONFIG[sdProblem.difficulty] || DIFFICULTY_CONFIG[0];

          return (
            <div className="w-full min-w-0 glass border border-white/10 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>System Design Challenge • {isSelectedToday ? "Today's Challenge" : selectedDate}</span>
                  </span>
                  {sdRecord.isSunday && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      <Zap className="w-3 h-3 fill-amber-400" />
                      Sunday 2x Selection
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

              {/* Sunday 2-problem switcher tabs */}
              {sdRecord.problems.length > 1 && (
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10 flex-wrap">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-amber-400" />
                    Sunday 2x Selection:
                  </span>
                  {sdRecord.problems.map((p, idx) => {
                    const isTabActive = currentIdx === idx;
                    const tabDiff = DIFFICULTY_CONFIG[p.difficulty] || DIFFICULTY_CONFIG[0];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDashboardSdIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                          isTabActive
                            ? 'bg-white/15 border-white/30 text-white shadow'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tabDiff.color }} />
                        <span>Problem {idx + 1}: {p.title}</span>
                        {p.isBackfill && p.backfillForDate && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 text-[10px] font-bold border border-purple-500/40">
                            Backfills {p.backfillForDate}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* If Sunday additional problem: clearly show for which date it is backfilled */}
              {sdProblem.isBackfill && sdProblem.backfillForDate && (
                <div className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                  <span>Sunday Catch-Up • Backfilled for {sdProblem.backfillForDate} (Day {sdProblem.backfillDayNumber})</span>
                </div>
              )}

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span>Problem #{sdProblem.id}</span>
                  <span>•</span>
                  <span>{sdRecord.date} ({sdRecord.dayName})</span>
                  {sdRecord.problems.length > 1 && (
                    <span className="text-amber-400 font-sans font-semibold">
                      (Problem {currentIdx + 1} of {sdRecord.problems.length})
                    </span>
                  )}
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
                    <span className="text-amber-300 font-medium">Sunday Arc: {sdRecord.problems.length} problems assigned on this date</span>
                  ) : (
                    <span>{sdUnlocked ? 'Full solution walkthroughs and articles available' : 'Spend the day designing components before 6 PM IST'}</span>
                  )}
                </div>

                <Link
                  href={`/system-design?date=${selectedDate}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-200 hover:text-white text-xs font-semibold border border-indigo-500/30 hover:border-indigo-500/50 transition-all shadow"
                >
                  <span>Explore Architecture Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })()}

        {/* LeetCode Question of the Day for the selected date */}
        {(() => {
          const istToday = getISTTime().dateStr;
          const isSelectedToday = selectedDate === istToday;
          const isFuture = selectedDate > istToday;

          // 1. Future Dates
          if (isFuture && !todayQotd) {
            return (
              <div className="w-full min-w-0 glass border border-white/10 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-semibold">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>LeetCode Daily Challenge</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-mono">
                    {selectedDate}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-slate-300 text-sm">
                  <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-white text-sm">Upcoming LeetCode Daily Challenge</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      The official daily coding challenge for {selectedDate} will be released on LeetCode on this date.
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          // 2. Loading state when we have no title and no submissions yet and it is loading
          if (qotdLoading && !problemTitle && !problemStatement) {
            return (
              <div className="w-full min-w-0 glass border border-white/10 rounded-2xl p-6 text-white flex items-center justify-center gap-3 py-12">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-400">Loading daily challenge details...</span>
              </div>
            );
          }

          // 3. Render problem if title or statement is available
          if (problemTitle || (problemStatement && problemStatement !== "No description available")) {
            const diffLower = (problemDifficulty || 'medium').toLowerCase();
            const diffConfig = diffLower === 'easy'
              ? { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: '#10b981', label: 'Easy' }
              : diffLower === 'hard'
              ? { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-300', dot: '#f43f5e', label: 'Hard' }
              : { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300', dot: '#f59e0b', label: 'Medium' };

            return (
              <div className="w-full min-w-0 glass border border-white/10 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-semibold">
                      <Code2 className="w-3.5 h-3.5" />
                      <span>LeetCode Challenge • {isSelectedToday ? "Today's Challenge" : selectedDate}</span>
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${diffConfig.bg} ${diffConfig.border} ${diffConfig.text}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: diffConfig.dot }} />
                      {diffConfig.label}
                    </span>

                    {problemAcRate && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-indigo-500/10 border-indigo-500/20 text-indigo-300">
                        <Percent className="w-3 h-3 text-indigo-400" />
                        <span>{problemAcRate} Acceptance</span>
                      </span>
                    )}

                    {problemId && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 text-xs font-mono border border-white/10">
                        Problem #{problemId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {/* Copy Announcement for WhatsApp / Group */}
                    <button
                      type="button"
                      onClick={handleCopyAnnouncement}
                      title="Copy daily challenge announcement for WhatsApp group"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 hover:border-white/20 transition-all shadow-sm"
                    >
                      {copiedAnnouncement ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Copied Group Post!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Group Post</span>
                        </>
                      )}
                    </button>

                    {problemLink && (
                      <a
                        href={problemLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 hover:text-white text-xs font-semibold border border-indigo-500/30 hover:border-indigo-500/50 transition-all shadow-sm"
                      >
                        <span>Solve on LeetCode</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Title and tags */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-indigo-300 transition-colors">
                      {problemTitle || 'Problem of the Day'}
                    </h3>
                  </div>

                  {problemTags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {problemTags.map((t: any) => (
                        <span
                          key={t.slug || t.name}
                          className="px-2 py-0.5 rounded-md bg-white/5 text-slate-400 text-[11px] border border-white/5"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Content */}
                {problemStatement && problemStatement !== "No description available" ? (
                  <div 
                    className="leetcode-content max-h-[400px] overflow-y-auto overflow-x-auto text-slate-300 pr-2 custom-scrollbar max-w-full text-sm border-t border-white/5 pt-4"
                    dangerouslySetInnerHTML={{ __html: problemStatement }}
                  />
                ) : qotdLoading ? (
                  <div className="flex items-center gap-2 py-6 text-slate-400 text-sm justify-center border-t border-white/5">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading problem statement...</span>
                  </div>
                ) : (
                  <div className="py-4 text-slate-400 text-sm border-t border-white/5 flex items-center justify-between gap-3">
                    <span>Problem statement description is available directly on LeetCode.</span>
                    {problemLink && (
                      <a
                        href={problemLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-1 shrink-0"
                      >
                        View on LeetCode <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })()}
      </div>

      <AnimatePresence>
        <SubmissionModal 
          selectedSub={selectedSub} 
          setSelectedSub={setSelectedSub} 
          submissions={submissions} 
          avatars={avatars} 
          userColors={userColors}
          qotdMap={qotdMap}
        />
      </AnimatePresence>
    </div>
  );
}
