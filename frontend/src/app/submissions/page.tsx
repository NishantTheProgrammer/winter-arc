'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { FileCode2, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface Submission {
  submissionId: string;
  username: string;
  title: string;
  titleSlug: string;
  date: string;
  timestamp: string;
  analyzed: boolean;
}

const USER_COLORS: Record<string, string> = {
  nishanttheprogrammer: 'linear-gradient(135deg, #6366f1, #a855f7)',
  mohittheprogrammer:   'linear-gradient(135deg, #f59e0b, #ef4444)',
  surajsingh542:        'linear-gradient(135deg, #10b981, #06b6d4)',
};

const USERS = ['All', 'nishanttheprogrammer', 'mohittheprogrammer', 'surajsingh542'];

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        setSubmissions(snapshot.docs.map(d => d.data() as Submission));
      } catch (err) {
        console.error('Failed to fetch submissions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

  const filtered = filter === 'All'
    ? submissions
    : submissions.filter(s => s.username === filter);

  const getInitial = (username: string) =>
    ({ nishanttheprogrammer: 'N', mohittheprogrammer: 'M', surajsingh542: 'S' }[username] ?? '?');

  return (
    <div className="p-8 md:p-10">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}>
            Submissions
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {filtered.length} accepted submissions
          </p>
        </div>

        {/* Filter */}
        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 rounded-xl text-sm font-medium text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {USERS.map(u => (
              <option key={u} value={u} style={{ background: '#1e1e3a' }}>
                {u === 'All' ? 'All Users' : u}
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
        <div className="flex flex-col gap-3">
          {filtered.map((sub, i) => (
            <motion.div
              key={sub.submissionId}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:border-white/15 hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* User avatar */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: USER_COLORS[sub.username] ?? 'rgba(99,102,241,0.5)' }}>
                {getInitial(sub.username)}
              </div>

              {/* Problem name */}
              <div className="flex-1 min-w-0">
                <a
                  href={`https://leetcode.com/problems/${sub.titleSlug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-sm text-white hover:text-indigo-400 transition-colors truncate block"
                >
                  {sub.title}
                </a>
                <p className="text-xs text-slate-500 mt-0.5">@{sub.username}</p>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {sub.date}
              </div>

              {/* Analyzed badge */}
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg flex-shrink-0 ${
                sub.analyzed
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
                style={{
                  background: sub.analyzed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                  border: sub.analyzed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                <CheckCircle2 className="w-3 h-3" />
                {sub.analyzed ? 'Analyzed' : 'Pending'}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
