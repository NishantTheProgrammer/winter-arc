'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Cpu, Code2, BookOpen } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface UserScore {
  username: string;
  displayName: string;
  totalScore: number;
  timeScore: number;
  spaceScore: number;
  readabilityScore: number;
  approach: string;
}

const DISPLAY_NAMES: Record<string, string> = {
  nishanttheprogrammer: 'Nishant',
  mohittheprogrammer:   'Mohit',
  surajsingh542:        'Suraj',
};

const RANK_STYLES = [
  { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', text: '🥇' },
  { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', text: '🥈' },
  { bg: 'linear-gradient(135deg,#cd7c2f,#a16207)', text: '🥉' },
];

export default function Leaderboard() {
  const [scores, setScores] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function fetchScores() {
      try {
        // Try to fetch today's AI analysis results
        const q = query(
          collection(db, 'analyses'),
          orderBy('totalScore', 'desc')
        );
        const snap = await getDocs(q);
        const todayDocs = snap.docs
          .map(d => d.data())
          .filter(d => d.date === today);

        if (todayDocs.length > 0) {
          setScores(todayDocs.map(d => ({
            username: d.username,
            displayName: DISPLAY_NAMES[d.username] ?? d.username,
            totalScore: d.totalScore ?? 0,
            timeScore: d.timeScore ?? 0,
            spaceScore: d.spaceScore ?? 0,
            readabilityScore: d.readabilityScore ?? 0,
            approach: d.approach ?? 'Unknown',
          })));
        } else {
          // Fallback: show all users with 0 score (no analysis yet today)
          const usersSnap = await getDocs(collection(db, 'users'));
          setScores(usersSnap.docs.map(d => {
            const u = d.data();
            return {
              username: u.username,
              displayName: u.displayName,
              totalScore: 0,
              timeScore: 0,
              spaceScore: 0,
              readabilityScore: 0,
              approach: 'Not analyzed yet',
            };
          }));
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, [today]);

  return (
    <div className="rounded-2xl p-6 w-full text-white"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold tracking-wide">Today's Leaderboard</h2>
        </div>
        <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
          {today}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading scores...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {scores.map((user, index) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={user.username}
              className="rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex items-center gap-4">
                {/* Rank badge */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shadow-inner flex-shrink-0"
                  style={{ background: index < 3 ? RANK_STYLES[index].bg : 'rgba(99,102,241,0.2)' }}>
                  {index < 3 ? RANK_STYLES[index].text : index + 1}
                </div>

                <div>
                  <h3 className="font-semibold text-base">{user.displayName}</h3>
                  <div className="flex gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-indigo-400" /> T:{user.timeScore.toFixed(1)}</span>
                    <span className="flex items-center gap-1"><Code2 className="w-3 h-3 text-purple-400" /> S:{user.spaceScore.toFixed(1)}</span>
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-pink-400" /> R:{user.readabilityScore.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden sm:block text-xs px-2.5 py-1 rounded-lg text-indigo-300"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {user.approach}
                </span>
                <div className="text-right">
                  <div className="text-2xl font-black text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(90deg,#fde68a,#d97706)' }}>
                    {user.totalScore > 0 ? user.totalScore.toFixed(1) : '—'}
                  </div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Score</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && scores.every(s => s.totalScore === 0) && (
        <p className="text-center text-xs text-slate-600 mt-4">
          No AI analysis for today yet. Trigger the pipeline after submitting today's problem.
        </p>
      )}
    </div>
  );
}
