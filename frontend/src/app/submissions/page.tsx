'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { FileCode2, CheckCircle2, Clock, ChevronDown, Building2, Users, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SubmissionModal from '@/components/SubmissionModal';
import { getCompaniesForProblem, getAllCompanies, isProminentCompany } from '@/lib/companyMapping';

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
  const [companyFilter, setCompanyFilter] = useState('All');
  const [selectedSub, setSelectedSub]   = useState<Submission | null>(null);
  const [avatars, setAvatars]           = useState<Record<string, string>>({});
  const [userColors, setUserColors]     = useState<Record<string, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [userList, setUserList]         = useState<string[]>(['All']);
  const [qotdMap, setQotdMap]           = useState<Record<string, any>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('company');
      const u = params.get('user');
      if (c) setCompanyFilter(c);
      if (u) setFilter(u);
    }
  }, []);

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

  const { availableCompanies, companyCounts, allOtherCompanies } = useMemo(() => {
    const counts: Record<string, number> = {};
    submissions.forEach(sub => {
      const cos = getCompaniesForProblem(sub.titleSlug);
      cos.forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
      });
    });

    const all = getAllCompanies();
    const withSubs = Object.keys(counts).sort((a, b) => {
      const aProm = isProminentCompany(a);
      const bProm = isProminentCompany(b);
      if (aProm && !bProm) return -1;
      if (!aProm && bProm) return 1;
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return a.localeCompare(b);
    });

    const withoutSubs = all.filter(c => !counts[c]);

    return {
      availableCompanies: withSubs,
      companyCounts: counts,
      allOtherCompanies: withoutSubs,
    };
  }, [submissions]);

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      if (filter !== 'All' && s.username !== filter) return false;
      if (companyFilter !== 'All') {
        const cos = getCompaniesForProblem(s.titleSlug);
        if (!cos.includes(companyFilter)) return false;
      }
      return true;
    });
  }, [submissions, filter, companyFilter]);

  const getInitial = (username: string) => {
    const dName = displayNames[username] || resolveDisplayName(username, displayNames);
    return (dName.charAt(0) || username.charAt(0)).toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
            >
              Submissions
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
              <span className="text-slate-400">
                {filtered.length} {filtered.length === 1 ? 'submission' : 'submissions'}
                {submissions.length !== filtered.length ? ` of ${submissions.length}` : ''}
              </span>
              {(filter !== 'All' || companyFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('All');
                    setCompanyFilter('All');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium flex items-center gap-1 cursor-pointer ml-1"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Filter dropdowns (User + Company) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter by User */}
            <div className="relative">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="appearance-none pl-9 pr-9 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {userList.map(u => (
                  <option key={u} value={u} style={{ background: '#1e1e3a' }}>
                    {u === 'All' ? 'All Users' : (displayNames[u] ? `${displayNames[u]} (@${u})` : `@${u}`)}
                  </option>
                ))}
              </select>
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>

            {/* Filter by Company */}
            <div className="relative">
              <select
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                className={`appearance-none pl-9 pr-9 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
                  companyFilter !== 'All'
                    ? 'text-purple-200 bg-purple-500/20 border border-purple-500/40 shadow-sm'
                    : 'text-slate-300 bg-white/5 border border-white/10'
                }`}
              >
                <option value="All" style={{ background: '#1e1e3a' }}>
                  All Companies ({submissions.length})
                </option>
                {availableCompanies.length > 0 && (
                  <optgroup label="Companies with submissions" style={{ background: '#1e1e3a' }}>
                    {availableCompanies.map(c => (
                      <option key={c} value={c} style={{ background: '#1e1e3a' }}>
                        {c} ({companyCounts[c]} {companyCounts[c] === 1 ? 'submission' : 'submissions'})
                      </option>
                    ))}
                  </optgroup>
                )}
                {allOtherCompanies.length > 0 && (
                  <optgroup label="Other companies" style={{ background: '#1e1e3a' }}>
                    {allOtherCompanies.map(c => (
                      <option key={c} value={c} style={{ background: '#1e1e3a' }}>
                        {c} (0)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <Building2 className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${companyFilter !== 'All' ? 'text-purple-400' : 'text-slate-500'}`} />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quick filter company pills */}
        {availableCompanies.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
            <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 shrink-0 mr-1">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Company:</span>
            </span>

            <button
              type="button"
              onClick={() => setCompanyFilter('All')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                companyFilter === 'All'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              All
            </button>

            {availableCompanies.slice(0, 12).map(c => {
              const isSelected = companyFilter === c;
              const count = companyCounts[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCompanyFilter(isSelected ? 'All' : c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-500/25 border border-purple-500/50 text-purple-200 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  <span>{c}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-purple-500/40 text-white' : 'bg-white/10 text-slate-400'
                  }`}>
                    {count}
                  </span>
                  {isSelected && <X className="w-3 h-3 text-purple-300" />}
                </button>
              );
            })}
          </div>
        )}
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
                    const diff = qInfo?.difficulty;
                    const cos = getCompaniesForProblem(sub.titleSlug);

                    if (!diff && cos.length === 0) return null;

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
                        {cos.length > 0 && (
                          <div className="inline-flex items-center gap-1">
                            {companyFilter !== 'All' && cos.includes(companyFilter) && (
                              <span className="text-[10px] text-purple-200 font-semibold bg-purple-500/25 px-1.5 py-0.5 rounded border border-purple-500/40 flex items-center gap-1 shadow-sm">
                                <Building2 className="w-2.5 h-2.5 text-purple-300" />
                                <span>{companyFilter}</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompanyFilter(companyFilter === cos[0] ? 'All' : cos[0]);
                              }}
                              className="text-[10px] text-purple-300 hover:text-white font-medium bg-purple-500/10 hover:bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/20 transition-all flex items-center gap-1 cursor-pointer"
                              title={`Asked by ${cos.length} companies: ${cos.slice(0, 8).join(', ')}${cos.length > 8 ? '...' : ''}. Click to filter by ${cos[0]}.`}
                            >
                              <Building2 className="w-2.5 h-2.5 text-purple-400" />
                              <span>{cos.length} {cos.length === 1 ? 'co.' : 'cos.'}</span>
                            </button>
                          </div>
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
