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
  { bg: 'linear-gradient(135deg,#fbbf24,#d97706)', text: '🥇' },
  { bg: 'linear-gradient(135deg,#cbd5e1,#64748b)', text: '🥈' },
  { bg: 'linear-gradient(135deg,#d97706,#7c2d12)', text: '🥉' },
];

interface LeaderboardProps {
  date: string;
  daySubmissions?: any[];
  avatars?: Record<string, string>;
  onRowClick?: (username: string) => void;
}

export default function Leaderboard({ date, daySubmissions, avatars, onRowClick }: LeaderboardProps) {
  const [scores, setScores] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Format the display title based on the selected date
  const isToday = date === new Date().toISOString().split('T')[0];
  const dateTitle = isToday ? "Today's Leaderboard" : `Leaderboard for ${date}`;

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
          .filter(d => d.date === date);

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
  }, [date]);

  return (
    <div className="rounded-2xl p-6 w-full text-white"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold tracking-wide">{dateTitle}</h2>
        </div>
        <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
          {date}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading scores...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(() => {
            let currentRank = 1;
            return scores.map((user, index) => {
              if (index > 0 && user.totalScore < scores[index - 1].totalScore) {
                currentRank++;
              }
              const rankIndex = currentRank - 1;
              return (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={user.username}
              onClick={() => onRowClick && onRowClick(user.username)}
              className={`rounded-xl p-4 flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 ${onRowClick ? 'cursor-pointer hover:bg-white/10' : ''}`}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  {avatars && avatars[user.username] ? (
                    <img 
                      src={avatars[user.username]} 
                      alt={user.username} 
                      className="w-12 h-12 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-slate-400">
                      {user.displayName.charAt(0)}
                    </div>
                  )}
                  {/* Rank badge at bottom right */}
                  {rankIndex < 3 ? (
                    <div className="absolute -bottom-1.5 -right-1.5 text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10 leading-none">
                      {RANK_STYLES[rankIndex].text}
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-[#151525] z-10 bg-slate-700 text-white">
                      {currentRank}
                    </div>
                  )}
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
                    style={{ backgroundImage: rankIndex < 3 ? RANK_STYLES[rankIndex].bg : 'linear-gradient(90deg,#9ca3af,#4b5563)' }}>
                    {user.totalScore > 0 ? user.totalScore.toFixed(1) : '—'}
                  </div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Score</div>
                </div>
              </div>
            </motion.div>
              );
            });
          })()}
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
