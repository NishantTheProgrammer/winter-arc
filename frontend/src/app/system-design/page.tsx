'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Clock,
  Lock,
  Unlock,
  ExternalLink,
  BookOpen,
  Calendar as CalendarIcon,
  Sparkles,
  Zap,
  Tag,
  CheckCircle2,
  ChevronRight,
  Info,
  ShieldAlert,
  Server,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DailySystemDesignRecord,
  SystemDesignProblem,
  DIFFICULTY_CONFIG,
  getISTTime,
  isResourcesUnlocked,
  formatCountdown,
  fetchTodaySystemDesign,
  fetchAllAssignedSystemDesign,
} from '@/lib/systemDesign';

export default function SystemDesignPage() {
  const [records, setRecords] = useState<DailySystemDesignRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activeProblemIndex, setActiveProblemIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);
  const [istTime, setIstTime] = useState<ReturnType<typeof getISTTime> | null>(null);

  // Real-time IST clock and countdown ticker (every 1 second)
  useEffect(() => {
    setMounted(true);
    setIstTime(getISTTime());
    const interval = setInterval(() => {
      setIstTime(getISTTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all assigned problems and default to today or latest
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch all assigned records
        const allRecords = await fetchAllAssignedSystemDesign();
        if (allRecords.length > 0) {
          setRecords(allRecords);
          const currentISTDate = getISTTime().dateStr;
          // Select today if present, else latest
          const todayRecord = allRecords.find(r => r.date === currentISTDate);
          if (todayRecord) {
            setSelectedDate(todayRecord.date);
          } else {
            setSelectedDate(allRecords[allRecords.length - 1].date);
          }
        } else {
          // If none found, fetch/pick today
          const today = await fetchTodaySystemDesign();
          if (today) {
            setRecords([today]);
            setSelectedDate(today.date);
          }
        }
      } catch (err) {
        console.error('Failed to load system design problems:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Reset active problem index when changing date
  useEffect(() => {
    setActiveProblemIndex(0);
  }, [selectedDate]);

  if (!mounted || !istTime) {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full min-w-0 space-y-8">
        <div className="glass rounded-3xl p-12 text-center border border-white/10">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Loading System Design challenge...</p>
        </div>
      </div>
    );
  }

  const activeRecord = records.find(r => r.date === selectedDate) || records[0];
  const activeProblem: SystemDesignProblem | undefined = activeRecord?.problems?.[activeProblemIndex] || activeRecord?.problems?.[0];

  const unlocked = activeRecord ? isResourcesUnlocked(activeRecord.date) : false;
  const isToday = activeRecord?.date === istTime.dateStr;

  // Calculate difficulty progression across all records
  const diffCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalCatalogPerDiff: Record<number, number> = { 0: 6, 1: 9, 2: 24, 3: 29, 4: 16, 5: 8 };
  let totalAssigned = 0;

  records.forEach(rec => {
    rec.problems?.forEach(p => {
      diffCounts[p.difficulty] = (diffCounts[p.difficulty] || 0) + 1;
      totalAssigned++;
    });
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full min-w-0 space-y-8">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>90-Day System Design Arc • Daily Challenge</span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text tracking-tight"
            style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
          >
            System Design Arc
          </h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
            One randomized architectural design problem per day, ascending strictly from foundational (Level 0) to senior distributed scale (Level 5).
          </p>
        </div>

        {/* IST Live Time & Status Pill */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="glass px-4 py-3 rounded-2xl flex items-center gap-3 border border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Indian Standard Time</p>
              <p className="text-sm font-mono font-bold text-slate-100">{istTime.formattedTime}</p>
            </div>
          </div>

          <div
            className={`px-4 py-3 rounded-2xl flex items-center gap-3 border transition-all duration-300 ${
              istTime.isAfter6PM
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {istTime.isAfter6PM ? (
              <>
                <Unlock className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">6:00 PM IST Passed</p>
                  <p className="text-xs font-medium">Resources &amp; Tags Unlocked</p>
                </div>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-400 animate-bounce" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">Unlocks at 6:00 PM IST</p>
                  <p className="text-xs font-mono font-bold text-amber-200">
                    in {formatCountdown(istTime.secondsUntil6PM)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Stats Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/10">
          <p className="text-xs font-medium text-slate-400">Total Problems</p>
          <p className="text-2xl font-black text-white mt-1">
            {totalAssigned} <span className="text-sm font-normal text-slate-500">/ 92</span>
          </p>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              style={{ width: `${Math.min(100, (totalAssigned / 92) * 100)}%` }}
            />
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10">
          <p className="text-xs font-medium text-slate-400">Current Difficulty</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">Level 0</p>
          <p className="text-[11px] text-slate-500 mt-1">Foundational concepts</p>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10">
          <p className="text-xs font-medium text-slate-400">Sunday Power-Up</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            <p className="text-xl font-black text-amber-300">2x Problems</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Double problem every Sunday</p>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10">
          <p className="text-xs font-medium text-slate-400">Daily Reveal Time</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-4 h-4 text-indigo-400" />
            <p className="text-xl font-black text-indigo-300">6:00 PM IST</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Independent design window</p>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center border border-white/10">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Loading System Design challenge...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center border border-white/10">
          <Compass className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No System Design Problems Picked Yet</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Pick today&apos;s problem using the CLI script or trigger button below to kick off the Arc.
          </p>
          <button
            onClick={async () => {
              setLoading(true);
              const p = await fetchTodaySystemDesign();
              if (p) {
                setRecords([p]);
                setSelectedDate(p.date);
              }
              setLoading(false);
            }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-semibold text-white text-sm shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
          >
            Pick Today&apos;s Problem Now
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Date Navigator Tabs ────────────────────────────────────────── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {records.map(rec => {
              const isSelected = rec.date === selectedDate;
              const isTodayRec = rec.date === istTime.dateStr;
              return (
                <button
                  key={rec.date}
                  onClick={() => setSelectedDate(rec.date)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
                  <span>{rec.date}</span>
                  <span className="opacity-60 text-[10px]">({rec.dayName.slice(0, 3)})</span>
                  {rec.isSunday && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                      2x
                    </span>
                  )}
                  {isTodayRec && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                      Today
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Problem Hero Card ──────────────────────────────────────────── */}
          {activeRecord && activeProblem && (
            <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6 relative overflow-hidden">
              {/* Subtle background glow */}
              <div
                className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-15 pointer-events-none blur-3xl"
                style={{
                  background:
                    activeProblem.difficulty <= 1
                      ? 'radial-gradient(circle, #06b6d4, #3b82f6)'
                      : activeProblem.difficulty <= 3
                      ? 'radial-gradient(circle, #f59e0b, #ef4444)'
                      : 'radial-gradient(circle, #a855f7, #ec4899)',
                }}
              />

              {/* Sunday multi-problem tabs */}
              {activeRecord.problems && activeRecord.problems.length > 1 && (
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mr-2">
                    <Zap className="w-4 h-4 fill-amber-400/20" />
                    Sunday 2x Selection:
                  </span>
                  {activeRecord.problems.map((prob, idx) => {
                    const isTabActive = activeProblemIndex === idx;
                    const diffStyle = DIFFICULTY_CONFIG[prob.difficulty] || DIFFICULTY_CONFIG[0];
                    return (
                      <button
                        key={prob.id}
                        onClick={() => setActiveProblemIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                          isTabActive
                            ? 'bg-white/15 border-white/30 text-white shadow'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: diffStyle.color }}
                        />
                        <span>Problem {idx + 1}: {prob.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Problem Title & Meta Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-slate-300 text-xs font-mono font-bold">
                      Problem #{activeProblem.id}
                    </span>

                    {/* Difficulty Badge */}
                    {(() => {
                      const diffStyle = DIFFICULTY_CONFIG[activeProblem.difficulty] || DIFFICULTY_CONFIG[0];
                      return (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${diffStyle.bgClass} ${diffStyle.borderClass} ${diffStyle.textClass}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: diffStyle.color }}
                          />
                          Difficulty {activeProblem.difficulty}: {diffStyle.label}
                        </span>
                      );
                    })()}

                    <span className="text-xs text-slate-400">
                      • {activeRecord.dayName}, {activeRecord.date}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {activeProblem.title}
                  </h2>
                </div>

                {/* Lock / Unlock Banner on problem */}
                <div
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 border ${
                    unlocked
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}
                >
                  {unlocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-emerald-400" />
                      <span>Solutions &amp; Tags Unlocked</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Unlocks at 6:00 PM IST ({formatCountdown(istTime.secondsUntil6PM)})</span>
                    </>
                  )}
                </div>
              </div>

              {/* Problem Statement Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Server className="w-4 h-4" />
                  Problem Statement
                </p>
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                  {activeProblem.problem_statement}
                </p>
              </div>

              {/* ── Topic Tags Section ──────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-400" />
                    <span>Architectural Tags &amp; Concepts</span>
                  </h3>
                  {!unlocked && (
                    <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Hidden until 6:00 PM IST
                    </span>
                  )}
                </div>

                {unlocked && activeProblem.tags && activeProblem.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeProblem.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-slate-400 text-xs">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-300">Topic Tags Protected</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tags reveal key components (caching, load balancing, sharding). Identify them independently first!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Resources & Solution Walkthroughs ───────────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span>Curated Resources &amp; Solution Walkthroughs</span>
                  </h3>
                  {!unlocked && (
                    <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Reveals at 6:00 PM IST
                    </span>
                  )}
                </div>

                {unlocked ? (
                  <div className="space-y-4">
                    {/* Resource Note if present */}
                    {activeProblem.resource_note && (
                      <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15 flex items-start gap-2.5 text-xs text-indigo-300 leading-relaxed">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{activeProblem.resource_note}</span>
                      </div>
                    )}

                    {/* Resources Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeProblem.resources?.map((res, i) => {
                        const isMain = res.role === 'main';
                        return (
                          <a
                            key={i}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 group ${
                              isMain
                                ? 'bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent border-indigo-500/30 hover:border-indigo-500/60 shadow-lg shadow-indigo-500/5'
                                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    isMain
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                      : 'bg-white/10 text-slate-300 border border-white/10'
                                  }`}
                                >
                                  {isMain ? '★ Main Walkthrough' : res.role.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-slate-500 capitalize">
                                  {res.type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                                <span>{res.title}</span>
                              </h4>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-indigo-400 group-hover:text-indigo-300">
                              <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                {new URL(res.url).hostname}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] font-semibold">
                                View Resource <ExternalLink className="w-3 h-3 ml-0.5" />
                              </span>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Locked State Container with Live Countdown */
                  <div className="p-8 rounded-2xl bg-white/[0.02] border border-amber-500/20 flex flex-col items-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Lock className="w-7 h-7" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">
                        Architecture Solutions Unlock at 6:00 PM IST
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md">
                        Spend your morning &amp; afternoon designing independently: outline requirements, calculate capacity, and sketch data models before reviewing the walkthroughs.
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-sm font-bold">
                      <Clock className="w-4 h-4 animate-spin text-amber-400" style={{ animationDuration: '6s' }} />
                      <span>Unlocks in {formatCountdown(istTime.secondsUntil6PM)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 90-Day Progression Roadmap ───────────────────────────────── */}
          <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-400" />
                <span>90-Day Difficulty Progression Ladder</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Problems are picked randomly within the lowest unlocked difficulty until exhausted, then level increases.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map(diff => {
                const conf = DIFFICULTY_CONFIG[diff];
                const count = diffCounts[diff] || 0;
                const total = totalCatalogPerDiff[diff] || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                const isCurrent = diff === 0; // Currently diff 0 is in progress
                return (
                  <div
                    key={diff}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-white/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: conf.color }}
                        />
                        <span className="font-bold text-sm text-white">Level {diff}: {conf.label}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {count} / {total}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: conf.color,
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
                      <span>{percentage.toFixed(0)}% completed</span>
                      {isCurrent && (
                        <span className="text-emerald-400 font-semibold">● Active Tier</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
