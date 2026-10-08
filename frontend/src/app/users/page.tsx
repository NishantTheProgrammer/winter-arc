'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { ExternalLink, Code2, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface User {
  username: string;
  displayName: string;
  createdAt: string;
}

const TOPICS = [
  "Brute Force", "Two Pointers", "Hashing", "Prefix Suffix", "Searching",
  "Sorting", "Stack", "Queue", "Linked List", "Recursion", "Backtracking",
  "Trees", "Heap Priority Queue", "Greedy", "Graphs", "Dynamic Programming",
  "Divide and Conquer", "Bit Manipulation", "String Algorithms", "Mathematics",
  "Range Queries", "Advanced Data Structures", "Computational Geometry", "Advanced Techniques"
];

export default function UsersPage() {
  const [users, setUsers]               = useState<User[]>([]);
  const [coveredTopics, setCoveredTopics] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const data = snapshot.docs.map(doc => doc.data() as User);
        setUsers(data);

        const subSnap = await getDocs(collection(db, 'submissions'));
        const rawSubData = subSnap.docs.map(doc => doc.data());

        // Deduplicate: keep only the latest submission per user per question
        const uniqueSubs = new Map();
        for (const sub of rawSubData) {
          const key = `${sub.username}_${sub.titleSlug}`;
          if (!uniqueSubs.has(key) || sub.timestamp > uniqueSubs.get(key).timestamp) {
            uniqueSubs.set(key, sub);
          }
        }
        const subData = Array.from(uniqueSubs.values());

        const coveredMap: Record<string, Set<string>> = {};
        data.forEach(u => (coveredMap[u.username] = new Set()));

        subData.forEach(sub => {
          if (!sub.username || !sub.analysis?.approachesUsed) return;
          // Only count submissions that were actually analyzed from code
          if (!sub.analyzed) return;

          sub.analysis.approachesUsed.forEach((path: string) => {
            // The LLM returns path strings like:
            //   "DSA > Two Pointers > Sliding Window > Fixed Size"
            //   or just "Two Pointers"
            // Split on common separators and look for the FIRST segment that
            // matches a top-level TOPICS entry — that is the real skill used.
            const segments = path
              .split(/\s*[>\/\->|,]\s*|\s+\-\s+/)
              .map(s => s.trim())
              .filter(Boolean);

            for (const segment of segments) {
              if (TOPICS.includes(segment)) {
                coveredMap[sub.username].add(segment);
                break; // only record the top-level category, not sub-topics
              }
            }
          });
        });
        setCoveredTopics(coveredMap);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const avatarColors = [
    'linear-gradient(135deg, #6366f1, #a855f7)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #10b981, #06b6d4)',
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="mb-6 sm:mb-8">
        <h1
          className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
        >
          Participants
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Winter Arc challenge members</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading users...
        </div>
      ) : (
        /* 1 col on mobile, 2 on md, 3 on xl */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {users.map((user, i) => (
            <motion.div
              key={user.username}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              }}
            >
              {/* Avatar + Name */}
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
                  style={{ background: avatarColors[i % avatarColors.length] }}
                >
                  {user.displayName[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white truncate">{user.displayName}</h2>
                  <p className="text-sm text-slate-500 truncate">@{user.username}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-3">
                <div
                  className="flex-1 rounded-xl p-3 text-center"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  <Code2 className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Submissions</p>
                </div>
                <div
                  className="flex-1 rounded-xl p-3 text-center"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
                >
                  <Trophy className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">AI Score</p>
                </div>
              </div>

              {/* Topics Grid */}
              <div className="border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center justify-between">
                  Topic Coverage
                  <span className="text-xs text-slate-500 font-normal">
                    {coveredTopics[user.username]?.size || 0} / {TOPICS.length}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {coveredTopics[user.username] && coveredTopics[user.username].size > 0 ? (
                    Array.from(coveredTopics[user.username]).map(topic => (
                      <div
                        key={topic}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      >
                        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                        <span>{topic}</span>
                      </div>
                    ))
                  ) : (
                    <div className="w-full text-center py-4 text-xs text-slate-500 italic bg-white/5 rounded-xl border border-white/5">
                      No topics covered yet
                    </div>
                  )}
                </div>
              </div>

              {/* LeetCode link */}
              <a
                href={`https://leetcode.com/${user.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 sm:py-3 mt-1 sm:mt-2 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80"
                style={{ background: 'rgba(255,161,22,0.1)', border: '1px solid rgba(255,161,22,0.2)', color: '#ffa116' }}
              >
                <ExternalLink className="w-4 h-4" />
                View on LeetCode
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
