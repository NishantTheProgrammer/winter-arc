'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { FileCode2, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

const USER_COLORS: Record<string, string> = {
  nishanttheprogrammer: 'linear-gradient(135deg, #6366f1, #a855f7)',
  mohittheprogrammer:   'linear-gradient(135deg, #f59e0b, #ef4444)',
  surajsingh542:        'linear-gradient(135deg, #10b981, #06b6d4)',
};

const USER_THEME_COLORS: Record<string, string> = {
  nishanttheprogrammer: '99, 102, 241', // indigo-500
  mohittheprogrammer:   '245, 158, 11',  // amber-500
  surajsingh542:        '16, 185, 129',  // emerald-500
};

const USERS = ['All', 'nishanttheprogrammer', 'mohittheprogrammer', 'surajsingh542'];

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
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

              {/* View Code Button */}
              <button 
                onClick={() => setSelectedSub(sub)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500/20 hover:bg-indigo-500/40 rounded-lg transition-colors border border-indigo-500/30"
              >
                View
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Code Modal Popup */}
      <AnimatePresence>
        {selectedSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSub(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(15,15,30,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex flex-col gap-3 px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="flex items-start justify-between w-full">
                  <h3 className="text-lg font-bold text-white leading-tight">{selectedSub.title}</h3>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <a
                      href={`https://leetcode.com/submissions/detail/${selectedSub.submissionId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-semibold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20 flex items-center gap-1"
                    >
                      View on LeetCode
                    </a>
                    <button 
                      onClick={() => setSelectedSub(null)}
                      className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* All Users Chips */}
                <div className="flex items-center flex-wrap gap-2 mt-1">
                  {submissions
                    .filter(s => s.titleSlug === selectedSub.titleSlug)
                    .map(sub => {
                      const isSelected = sub.submissionId === selectedSub.submissionId;
                      const rgb = USER_THEME_COLORS[sub.username] || '99, 102, 241';
                      const score = sub.analysis?.aggregatedScore?.toFixed(1);
                      return (
                        <button
                          key={sub.submissionId}
                          onClick={() => setSelectedSub(sub)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 hover:brightness-125 ${
                            isSelected ? 'shadow-[0_0_15px_rgba(255,255,255,0.02)]' : ''
                          }`}
                          style={{ 
                            color: `rgb(${rgb})`,
                            backgroundColor: isSelected ? `rgba(${rgb}, 0.15)` : `rgba(${rgb}, 0.04)`,
                            border: `1px solid rgba(${rgb}, ${isSelected ? 0.3 : 0.1})`
                          }}
                        >
                          @{sub.username}{score ? ` (${score})` : ''}
                        </button>
                      );
                  })}
                  <span className="text-[10px] font-medium text-slate-500 ml-2 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    {selectedSub.date}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-[#1e1e1e] flex flex-col gap-4">
                
                {/* Problem Statement Collapsible */}
                {selectedSub.questionContext && selectedSub.questionContext !== "No description available" && (
                  <details className="group border border-white/10 bg-white/5 rounded-xl overflow-hidden shrink-0">
                    <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-slate-300 hover:text-white bg-white/5 select-none flex items-center justify-between">
                      Problem Statement
                      <span className="text-slate-500 transition-transform group-open:-rotate-180">▼</span>
                    </summary>
                    <div 
                      className="p-4 text-sm text-slate-300 border-t border-white/10 bg-[#1e1e1e]/50 max-h-[300px] overflow-y-auto leetcode-content"
                      dangerouslySetInnerHTML={{ __html: selectedSub.questionContext }}
                    />
                  </details>
                )}

                {/* AI Analysis Report */}
                {selectedSub.analyzed && selectedSub.analysis && (
                  <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl overflow-hidden flex flex-col shrink-0">
                    <div className="px-4 py-3 border-b border-indigo-500/20 bg-indigo-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-indigo-400 font-bold">AI Analysis Report</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-indigo-300">Score:</span>
                        <span className="text-lg font-black text-white">{selectedSub.analysis.aggregatedScore?.toFixed(1) || '0.0'}<span className="text-xs text-indigo-400">/10</span></span>
                      </div>
                    </div>
                    
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-indigo-500/10">
                      {/* Efficiency */}
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5 shadow-inner">
                        <p className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider border-b border-amber-400/20 pb-1">Efficiency (40%)</p>
                        <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Time:</span> <span className="text-white">{selectedSub.analysis.timeComplexityScore}/10</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400">Space:</span> <span className="text-white">{selectedSub.analysis.spaceComplexityScore}/10</span></div>
                      </div>
                      {/* Quality */}
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5 shadow-inner">
                        <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider border-b border-emerald-400/20 pb-1">Quality (20%)</p>
                        <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Readability:</span> <span className="text-white">{selectedSub.analysis.readabilityScore}/10</span></div>
                        <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Maintainability:</span> <span className="text-white">{selectedSub.analysis.maintainabilityScore}/10</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400">Simplicity:</span> <span className="text-white">{selectedSub.analysis.simplicityScore}/10</span></div>
                      </div>
                      {/* Robustness */}
                      <div className="bg-black/20 p-3 rounded-lg border border-white/5 shadow-inner">
                        <p className="text-xs font-semibold text-pink-400 mb-2 uppercase tracking-wider border-b border-pink-400/20 pb-1">Robustness (15%)</p>
                        <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Edge Cases:</span> <span className="text-white">{selectedSub.analysis.edgeCasesScore}/10</span></div>
                        <div className="flex justify-between text-xs"><span className="text-slate-400">Error Handling:</span> <span className="text-white">{selectedSub.analysis.errorHandlingScore}/10</span></div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-black/10">
                      <p className="text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wider">AI Feedback</p>
                      <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/50 pl-3">"{selectedSub.analysis.feedback}"</p>
                    </div>
                  </div>
                )}

                {/* Code Viewer */}
                {selectedSub.code ? (
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-[#1e1e1e] shrink-0">
                    <SyntaxHighlighter
                      language={selectedSub.language || 'javascript'}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '14px' }}
                      showLineNumbers
                    >
                      {selectedSub.code}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3">
                    <FileCode2 className="w-10 h-10 opacity-50" />
                    <p>Code not available yet.</p>
                    <p className="text-xs">The code will be fetched and stored when the AI analysis pipeline is triggered.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
