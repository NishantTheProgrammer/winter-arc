'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { Users as UsersIcon, ExternalLink, Code2, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface User {
  username: string;
  displayName: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const data = snapshot.docs.map(doc => doc.data() as User);
        setUsers(data);
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
    <div className="p-8 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {users.map((user, i) => (
            <motion.div
              key={user.username}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              }}
            >
              {/* Avatar + Name */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white"
                  style={{ background: avatarColors[i % avatarColors.length] }}>
                  {user.displayName[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{user.displayName}</h2>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-3">
                <div className="flex-1 rounded-xl p-3 text-center"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Code2 className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Submissions</p>
                </div>
                <div className="flex-1 rounded-xl p-3 text-center"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <Trophy className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">AI Score</p>
                </div>
              </div>

              {/* LeetCode link */}
              <a
                href={`https://leetcode.com/${user.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80"
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
