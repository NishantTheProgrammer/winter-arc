'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { ExternalLink, Code2, Trophy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import hierarchyData from '@/data/hierarchy.json';
import CompetitiveGraph from '@/components/CompetitiveGraph';
import { getUserTheme } from '@/lib/userTheme';
import { calculateAggregatedScore } from '@/lib/scoreCalculator';

interface User {
  username: string;
  displayName: string;
  createdAt?: string;
  themeColor?: string;
}

interface UserStat {
  totalSubmissions: number;
  analyzedCount: number;
  avgScore: number;
}

// Canonical 24 topics loaded strictly from hierarchy.json
const HIERARCHY_TOPICS: string[] = Object.keys(hierarchyData.DSA);

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [coveredTopics, setCoveredTopics] = useState<Record<string, Set<string>>>({});
  const [userStats, setUserStats] = useState<Record<string, UserStat>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [userColors, setUserColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch Users
        const snapshot = await getDocs(collection(db, 'users'));
        const usersList = snapshot.docs.map(doc => doc.data() as User);
        setUsers(usersList);

        const colorMap: Record<string, string> = {};
        usersList.forEach(u => {
          if (u.username && u.themeColor) colorMap[u.username] = u.themeColor;
        });

        // 2. Fetch Avatars and Colors from participants collection
        const partSnap = await getDocs(collection(db, 'participants'));
        const avatarMap: Record<string, string> = {};
        partSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.username) {
            if (data.avatar) avatarMap[data.username] = data.avatar;
            if (data.themeColor) colorMap[data.username] = data.themeColor;
          }
        });
        setAvatars(avatarMap);
        setUserColors(colorMap);

        // 3. Fetch QOTD collection for the Winter Arc challenge
        const qotdSnap = await getDocs(collection(db, 'qotd'));
        const qotdSlugs = new Set<string>();
        const slugToQotdDate: Record<string, string> = {};
        qotdSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.titleSlug) {
            qotdSlugs.add(data.titleSlug);
            slugToQotdDate[data.titleSlug] = doc.id;
          }
        });

        // 4. Fetch Submissions and filter strictly for Winter Arc challenge
        const subSnap = await getDocs(collection(db, 'submissions'));
        const rawSubData: any[] = subSnap.docs.map(doc => {
          const data = doc.data() as any;
          if (slugToQotdDate[data.titleSlug]) {
            return { ...data, date: slugToQotdDate[data.titleSlug], isChallenge: true };
          }
          return { ...data, isChallenge: qotdSlugs.has(data.titleSlug) };
        });

        // Strictly filter to Winter Arc challenge problems
        const winterArcData = rawSubData.filter((sub: any) => {
          if (qotdSlugs.size > 0) {
            return qotdSlugs.has(sub.titleSlug);
          }
          return sub.date >= '2026-10-01' && sub.date <= '2026-12-31';
        });

        // Deduplicate: keep only the latest submission per user per question
        const uniqueSubs = new Map();
        for (const sub of winterArcData) {
          const key = `${sub.username}_${sub.titleSlug}`;
          if (!uniqueSubs.has(key) || sub.timestamp > uniqueSubs.get(key).timestamp) {
            uniqueSubs.set(key, sub);
          }
        }
        const subData = Array.from(uniqueSubs.values());
        setSubmissions(subData);

        // 5. Extract Topic Coverage strictly from hierarchy.json
        const coveredMap: Record<string, Set<string>> = {};
        usersList.forEach(u => (coveredMap[u.username] = new Set()));

        subData.forEach(sub => {
          if (!sub.username || !sub.analysis?.approachesUsed) return;
          if (!sub.analyzed) return;

          sub.analysis.approachesUsed.forEach((path: string) => {
            // Split segments like "Dynamic Programming > Memoization"
            const segments = path
              .split(/\s*[>\/\->|,]\s*|\s+\-\s+/)
              .map(s => s.trim())
              .filter(Boolean);

            for (const segment of segments) {
              // Ensure topic is strictly recognized in hierarchy.json
              if (HIERARCHY_TOPICS.includes(segment)) {
                if (coveredMap[sub.username]) {
                  coveredMap[sub.username].add(segment);
                }
                break; // Top-level hierarchy domain matched
              }
            }
          });
        });
        setCoveredTopics(coveredMap);

        // 6. Compute user aggregate stats strictly for Winter Arc challenge with runtime score calculation
        const stats: Record<string, UserStat> = {};
        usersList.forEach(u => {
          const uSubs = subData.filter(s => s.username === u.username);
          const analyzed = uSubs.filter(s => s.analyzed && s.analysis);
          const avg = analyzed.length
            ? Number((analyzed.reduce((acc, s) => acc + calculateAggregatedScore(s.analysis), 0) / analyzed.length).toFixed(1))
            : 0;

          stats[u.username] = {
            totalSubmissions: uSubs.length,
            analyzedCount: analyzed.length,
            avgScore: avg,
          };
        });
        setUserStats(stats);
      } catch (err) {
        console.error('Failed to fetch users and stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1
          className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
        >
          Participants &amp; Competitive Analytics
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Winter Arc challenge members, DSA topic coverage &amp; performance comparison
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading participant analytics...
        </div>
      ) : (
        <>
          {/* Individual Member Cards Grid */}
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white mb-1">Challenge Members</h2>
            <p className="text-xs text-slate-400">Detailed profiles, topic coverage breakdown &amp; LeetCode stats</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mb-8 sm:mb-10">
            {users.map((user, i) => {
              const stat = userStats[user.username] || { totalSubmissions: 0, analyzedCount: 0, avgScore: 0 };
              const coveredCount = coveredTopics[user.username]?.size || 0;
              const theme = getUserTheme(user.username, userColors[user.username] || user.themeColor);

              return (
                <motion.div
                  key={user.username}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:-translate-y-1"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                  }}
                >
                  <div className="flex flex-col gap-4">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3.5">
                      {avatars[user.username] ? (
                        <img
                          src={avatars[user.username]}
                          alt={user.displayName}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-white/10 shadow-md shrink-0"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-md border"
                          style={{
                            background: theme.bg,
                            borderColor: theme.border,
                            color: theme.stroke,
                          }}
                        >
                          {(user.displayName?.[0] || user.username.charAt(0)).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-white truncate">{user.displayName}</h2>
                        <p className="text-xs text-slate-400 truncate">@{user.username}</p>
                      </div>
                    </div>

                    {/* Stats row with real live values */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div
                        className="rounded-xl p-2.5 text-center flex flex-col items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                      >
                        <div className="flex items-center gap-1 text-indigo-400 mb-0.5">
                          <Code2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase font-bold tracking-wider">Challenge Solved</span>
                        </div>
                        <p className="text-base sm:text-lg font-black text-white">{stat.totalSubmissions}</p>
                      </div>

                      <div
                        className="rounded-xl p-2.5 text-center flex flex-col items-center justify-center"
                        style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
                      >
                        <div className="flex items-center gap-1 text-purple-400 mb-0.5">
                          <Trophy className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase font-bold tracking-wider">Avg Score</span>
                        </div>
                        <p className="text-base sm:text-lg font-black text-white">
                          {stat.avgScore > 0 ? `${stat.avgScore}` : '—'}
                          <span className="text-xs font-normal text-slate-400">/10</span>
                        </p>
                      </div>
                    </div>

                    {/* Topics Grid strictly from hierarchy.json */}
                    <div className="border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Topic Coverage
                        </h3>
                        <span className="text-xs text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {coveredCount} / {HIERARCHY_TOPICS.length}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                        {coveredTopics[user.username] && coveredTopics[user.username].size > 0 ? (
                          Array.from(coveredTopics[user.username]).map(topic => (
                            <div
                              key={topic}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            >
                              <Check className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{topic}</span>
                            </div>
                          ))
                        ) : (
                          <div className="w-full text-center py-4 text-xs text-slate-500 italic bg-white/5 rounded-xl border border-white/5">
                            No topics covered yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LeetCode link */}
                  <a
                    href={`https://leetcode.com/${user.username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-85 mt-2"
                    style={{
                      background: 'rgba(255,161,22,0.1)',
                      border: '1px solid rgba(255,161,22,0.2)',
                      color: '#ffa116',
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on LeetCode
                  </a>
                </motion.div>
              );
            })}
          </div>

          {/* Competitive Graph Section */}
          <CompetitiveGraph
            users={users}
            submissions={submissions}
            coveredTopics={coveredTopics}
            avatars={avatars}
            userColors={userColors}
            hierarchyTopics={HIERARCHY_TOPICS}
          />
        </>
      )}
    </div>
  );
}
