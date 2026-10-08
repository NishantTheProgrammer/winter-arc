"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Code2, Cpu } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface UserScore {
  id: string;
  name: string;
  totalScore: number;
  timeScore: number;
  spaceScore: number;
  readabilityScore: number;
  approaches: string[];
}

const Leaderboard = () => {
  const [scores, setScores] = useState<UserScore[]>([
    { id: '1', name: 'Nishant', totalScore: 9.2, timeScore: 9.5, spaceScore: 9.0, readabilityScore: 9.1, approaches: ['Two Pointers'] },
    { id: '2', name: 'Friend 1', totalScore: 8.7, timeScore: 8.5, spaceScore: 8.8, readabilityScore: 8.8, approaches: ['Sliding Window'] },
    { id: '3', name: 'Friend 2', totalScore: 7.9, timeScore: 7.0, spaceScore: 8.0, readabilityScore: 8.7, approaches: ['Brute Force'] },
  ]);

  // Optionally fetch from Firebase later
  // useEffect(() => { ... fetch from firestore ... }, []);

  return (
    <div className="glass rounded-2xl p-6 w-full max-w-2xl text-white">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-7 h-7 text-yellow-400" />
        <h2 className="text-2xl font-bold tracking-wider">Today's Leaderboard</h2>
      </div>

      <div className="flex flex-col gap-4">
        {scores.map((user, index) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            key={user.id} 
            className="glass-hover rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center font-bold text-lg shadow-inner">
                {index + 1}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{user.name}</h3>
                <div className="flex gap-2 text-xs text-gray-400 mt-1">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3"/> T: {user.timeScore}</span>
                  <span className="flex items-center gap-1"><Code2 className="w-3 h-3"/> S: {user.spaceScore}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden sm:block">
                <span className="text-xs bg-white/10 px-2 py-1 rounded-md text-indigo-300">
                  {user.approaches[0]}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600">
                  {user.totalScore.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-widest">Score</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
