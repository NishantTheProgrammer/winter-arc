'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { FileCode2, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SubmissionModal from '@/components/SubmissionModal';

import { getUserTheme, resolveDisplayName } from '@/lib/userTheme';

interface Submission {
  submissionId: string;
  username: string;
  title: string;
  titleSlug: string;
  date: string;
  timestamp: string;
  analyzed: boolean;
  code?: string;
  language?: string;
  questionContext?: string;
  analysis?: any;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions]   = useState<Submission[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('All');
  const [selectedSub, setSelectedSub]   = useState<Submission | null>(null);
  const [avatars, setAvatars]           = useState<Record<string, string>>({});
  const [userColors, setUserColors]     = useState<Record<string, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [userList, setUserList]         = useState<string[]>(['All']);
  const [qotdMap, setQotdMap]           = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        // Fetch QOTD for problem difficulty and acceptance rate
        const qotdSnap = await getDocs(collection(db, 'qotd'));
        const qMap: Record<string, any> = {};
        qotdSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.titleSlug) qMap[data.titleSlug] = data;
          if (data.date) qMap[data.date] = data;
        });
        setQotdMap(qMap);

        const q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const rawData = snapshot.docs.map(d => d.data() as Submission);
        
        // Deduplicate: keep only the latest submission per user per question
        const uniqueSubs = new Map<string, Submission>();
        for (const sub of rawData) {
          const key = `${sub.username}_${sub.titleSlug}`;
          if (!uniqueSubs.has(key) || sub.timestamp > uniqueSubs.get(key)!.timestamp) {
            uniqueSubs.set(key, sub);
          }
        }
        
        const dedupedData = Array.from(uniqueSubs.values());
        const winterArcData = dedupedData.filter(sub => sub.date >= '2026-10-01' && sub.date <= '2026-12-31');
        setSubmissions(winterArcData);

        // Fetch participants and users dynamically from Firestore
        const partSnap = await getDocs(collection(db, 'participants'));
        const avatarMap: Record<string, string> = {};
        const colorMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        const participantUsernames: string[] = [];

        partSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.username) {
            participantUsernames.push(data.username);
            if (data.avatar) avatarMap[data.username] = data.avatar;
            if (data.themeColor) colorMap[data.username] = data.themeColor;
            if (data.displayName) nameMap[data.username] = data.displayName;
          }
        });

        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.username) {
            if (!participantUsernames.includes(data.username)) {
              participantUsernames.push(data.username);
            }
            if (data.displayName && !nameMap[data.username]) {
              nameMap[data.username] = data.displayName;
            }
            if (data.themeColor && !colorMap[data.username]) {
              colorMap[data.username] = data.themeColor;
            }
          }
        });

        // Combine with all submission usernames so no one is missed
        const allUsernames = Array.from(
          new Set([...participantUsernames, ...winterArcData.map(s => s.username)])
        ).sort();

        setUserList(['All', ...allUsernames]);
        setAvatars(avatarMap);
        setUserColors(colorMap);
        setDisplayNames(nameMap);
      } catch (err) {
        console.error('Failed to fetch submissions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

  const filtered = filter === 'All' ? submissions : submissions.filter(s => s.username === filter);

  const getInitial = (username: string) => {
    const dName = displayNames[username] || resolveDisplayName(username, displayNames);
    return (dName.charAt(0) || username.charAt(0)).toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
          >
            Submissions
          </h1>
          <p className="text-slate-500 mt-1 text-sm">{filtered.length} accepted submissions</p>
        </div>

        {/* Filter dropdown */}
        <div className="relative self-start sm:self-auto">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 rounded-xl text-sm font-medium text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {userList.map(u => (
              <option key={u} value={u} style={{ background: '#1e1e3a' }}>
                {u === 'All' ? 'All Users' : (displayNames[u] ? `${displayNames[u]} (@${u})` : `@${u}`)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading submissions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <FileCode2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No submissions found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3">
          {filtered.map((sub, i) => (
            <motion.div
              key={sub.submissionId}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl transition-all duration-200 hover:border-white/15 hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Avatar */}
              {avatars[sub.username] ? (
                <img
                  src={avatars[sub.username]}
                  alt={sub.username}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex-shrink-0 object-cover shadow-sm bg-white/5 border border-white/10"
                />
              ) : (
                <div
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0"
                  style={{
                    background: getUserTheme(sub.username, userColors[sub.username]).bg,
                    border: `1px solid ${getUserTheme(sub.username, userColors[sub.username]).border}`,
                    color: getUserTheme(sub.username, userColors[sub.username]).stroke,
                  }}
                >
                  {getInitial(sub.username)}
                </div>
              )}

              {/* Problem name + difficulty & acceptance rate */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`https://leetcode.com/problems/${sub.titleSlug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sm text-white hover:text-indigo-400 transition-colors truncate block"
                  >
                    {sub.title}
                  </a>

                  {(() => {
                    const qInfo = qotdMap[sub.titleSlug] || qotdMap[sub.date];
                    if (!qInfo) return null;
                    const diff = qInfo.difficulty;
                    const acRate = typeof qInfo.acRate === 'number' ? `${qInfo.acRate.toFixed(1)}%` : null;

                    return (
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        {diff && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                              diff.toLowerCase() === 'easy'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : diff.toLowerCase() === 'hard'
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            }`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  diff.toLowerCase() === 'easy'
                                    ? '#10b981'
                                    : diff.toLowerCase() === 'hard'
                                    ? '#f43f5e'
                                    : '#f59e0b',
                              }}
                            />
                            {diff}
                          </span>
                        )}
                        {acRate && (
                          <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                            {acRate} ac
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">@{sub.username}</p>
              </div>

              {/* Date — hidden on xs */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {sub.date}
              </div>

              {/* Analyzed badge */}
              <div
                className={`flex items-center gap-1 sm:gap-1.5 text-xs px-2 sm:px-2.5 py-1 rounded-lg flex-shrink-0 ${
                  sub.analyzed ? 'text-emerald-400' : 'text-slate-500'
                }`}
                style={{
                  background: sub.analyzed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                  border: sub.analyzed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden xs:inline">{sub.analyzed ? 'Analyzed' : 'Pending'}</span>
              </div>

              {/* View button */}
              <button
                onClick={() => setSelectedSub(sub)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500/20 hover:bg-indigo-500/40 rounded-lg transition-colors border border-indigo-500/30 flex-shrink-0"
              >
                View
              </button>
            </motion.div>
          ))}
        </div>
      )}

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
