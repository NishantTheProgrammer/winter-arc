import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SubmissionModalProps {
  selectedSub: any;
  setSelectedSub: (sub: any | null) => void;
  submissions: any[];
  avatars: Record<string, string>;
}

const USER_THEME_COLORS: Record<string, string> = {
  nishanttheprogrammer: '99, 102, 241',
  mohittheprogrammer:   '245, 158, 11',
  surajsingh542:        '16, 185, 129',
};

export default function SubmissionModal({ selectedSub, setSelectedSub, submissions, avatars }: SubmissionModalProps) {
  if (!selectedSub) return null;

  return (
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
                    {avatars[sub.username] && (
                      <img src={avatars[sub.username]} alt="avatar" className="w-4 h-4 rounded-full object-cover bg-white/10" />
                    )}
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
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  background: 'transparent',
                  fontSize: '0.875rem',
                }}
                showLineNumbers
              >
                {selectedSub.code}
              </SyntaxHighlighter>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-white/5 rounded-xl border border-white/10 shrink-0">
              <span className="text-3xl mb-2">🤷‍♂️</span>
              <p>Code not available</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
