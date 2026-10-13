'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Layers, Award, Check, Filter, Columns, Rows, Table, Info } from 'lucide-react';
import { getUserTheme, UserTheme } from '@/lib/userTheme';

interface CompetitiveGraphProps {
  users: Array<{ username: string; displayName: string; themeColor?: string }>;
  submissions: any[];
  coveredTopics: Record<string, Set<string>>;
  avatars: Record<string, string>;
  hierarchyTopics: string[];
  userColors?: Record<string, string>;
}

export default function CompetitiveGraph({
  users,
  submissions,
  coveredTopics,
  avatars,
  hierarchyTopics,
  userColors,
}: CompetitiveGraphProps) {
  const getUserColors = (username: string): UserTheme => {
    return getUserTheme(username, userColors?.[username]);
  };
  const [activeTab, setActiveTab] = useState<'timeline' | 'matrix' | 'head2head'>('timeline');
  const [highlightedUser, setHighlightedUser] = useState<string | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'covered' | 'uncovered'>('all');
  const [matrixOrientation, setMatrixOrientation] = useState<'topics-rows' | 'participants-rows'>('topics-rows');
  const [hoveredCell, setHoveredCell] = useState<{
    username: string;
    displayName: string;
    topic: string;
    count: number;
    problems: string[];
  } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    date: string;
    username: string;
    score: number;
    dayScore: number;
  } | null>(null);

  // 1. Calculate dates in Winter Arc (Oct 1 to Oct 13)
  const timelineDates = useMemo(() => {
    const datesSet = new Set<string>();
    submissions.forEach(s => {
      if (s.date && s.date >= '2026-10-01' && s.date <= '2026-12-31') {
        datesSet.add(s.date);
      }
    });
    // Fallback to initial October days if no submissions
    if (datesSet.size === 0) {
      for (let i = 1; i <= 13; i++) {
        datesSet.add(`2026-10-${String(i).padStart(2, '0')}`);
      }
    }
    return Array.from(datesSet).sort();
  }, [submissions]);

  // 2. Compute cumulative score trends for each participant
  const trajectoryData = useMemo(() => {
    return users.map(user => {
      let cumulative = 0;
      const points = timelineDates.map(date => {
        const match = submissions.find(s => s.username === user.username && s.date === date && s.analyzed);
        const dayScore = match?.analysis?.aggregatedScore || 0;
        cumulative += dayScore;
        return {
          date,
          dayScore,
          cumulativeScore: Number(cumulative.toFixed(1)),
        };
      });

      return {
        user,
        finalScore: cumulative,
        points,
      };
    });
  }, [users, submissions, timelineDates]);

  // Detailed Topic Problem counts & solved problem titles strictly matched to hierarchy
  const topicStats = useMemo(() => {
    const stats: Record<string, Record<string, { count: number; problems: string[] }>> = {};
    users.forEach(u => {
      stats[u.username] = {};
      hierarchyTopics.forEach(t => {
        stats[u.username][t] = { count: 0, problems: [] };
      });
    });

    submissions.forEach(sub => {
      if (!sub.username || !sub.analyzed || !sub.analysis?.approachesUsed) return;
      if (!stats[sub.username]) return;

      const matchedTopics = new Set<string>();
      sub.analysis.approachesUsed.forEach((path: string) => {
        const segments = path
          .split(/\s*[>\/\->|,]\s*|\s+\-\s+/)
          .map(s => s.trim())
          .filter(Boolean);

        for (const segment of segments) {
          if (hierarchyTopics.includes(segment)) {
            matchedTopics.add(segment);
            break;
          }
        }
      });

      matchedTopics.forEach(topic => {
        const item = stats[sub.username]?.[topic];
        if (item) {
          item.count += 1;
          const probTitle = sub.title || sub.titleSlug;
          if (probTitle && !item.problems.includes(probTitle)) {
            item.problems.push(probTitle);
          }
        }
      });
    });

    return stats;
  }, [users, submissions, hierarchyTopics]);

  // Total unique problems solved per participant in the canonical hierarchy
  const userTotalHierarchyProblems = useMemo(() => {
    const totals: Record<string, number> = {};
    users.forEach(u => {
      const uniqueProblems = new Set<string>();
      hierarchyTopics.forEach(t => {
        const item = topicStats[u.username]?.[t];
        if (item) {
          item.problems.forEach(p => uniqueProblems.add(p));
        }
      });
      totals[u.username] = uniqueProblems.size;
    });
    return totals;
  }, [users, hierarchyTopics, topicStats]);

  // Total unique problems solved across team per topic
  const topicTeamTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    hierarchyTopics.forEach(t => {
      const topicProblems = new Set<string>();
      users.forEach(u => {
        const item = topicStats[u.username]?.[t];
        if (item) {
          item.problems.forEach(p => topicProblems.add(p));
        }
      });
      totals[t] = topicProblems.size;
    });
    return totals;
  }, [users, hierarchyTopics, topicStats]);

  // Dynamic GitHub-style commit cell weight style
  const getCellWeightStyle = (username: string, count: number) => {
    const colors = getUserColors(username);
    if (count === 0) {
      return {
        bg: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        text: '#475569',
        tier: 0,
        boxShadow: 'none',
        tierLabel: 'Tier 0 • Unexplored',
      };
    }
    if (count <= 2) {
      return {
        bg: `rgba(${colors.rgb}, 0.22)`,
        border: `1px solid rgba(${colors.rgb}, 0.40)`,
        text: '#e2e8f0',
        tier: 1,
        boxShadow: 'none',
        tierLabel: 'Tier 1 • Introduced',
      };
    }
    if (count <= 5) {
      return {
        bg: `rgba(${colors.rgb}, 0.45)`,
        border: `1px solid rgba(${colors.rgb}, 0.65)`,
        text: '#ffffff',
        tier: 2,
        boxShadow: 'none',
        tierLabel: 'Tier 2 • Proficient',
      };
    }
    if (count <= 10) {
      return {
        bg: `rgba(${colors.rgb}, 0.72)`,
        border: `1px solid rgba(${colors.rgb}, 0.90)`,
        text: '#ffffff',
        tier: 3,
        boxShadow: `0 0 10px rgba(${colors.rgb}, 0.35)`,
        tierLabel: 'Tier 3 • Advanced',
      };
    }
    return {
      bg: colors.stroke,
      border: '1px solid #ffffff',
      text: '#ffffff',
      tier: 4,
      boxShadow: `0 0 16px rgba(${colors.rgb}, 0.6)`,
      tierLabel: 'Tier 4 • Mastered',
    };
  };

  // 3. User metrics for head-to-head and summary
  const userMetrics = useMemo(() => {
    return users.map(user => {
      const userSubs = submissions.filter(s => s.username === user.username);
      const analyzed = userSubs.filter(s => s.analyzed && s.analysis && typeof s.analysis.aggregatedScore === 'number');

      const totalScore = analyzed.reduce((acc, s) => acc + (s.analysis.aggregatedScore || 0), 0);
      const avgScore = analyzed.length ? totalScore / analyzed.length : 0;
      const avgTime = analyzed.length ? analyzed.reduce((acc, s) => acc + (s.analysis.timeComplexityScore || 0), 0) / analyzed.length : 0;
      const avgSpace = analyzed.length ? analyzed.reduce((acc, s) => acc + (s.analysis.spaceComplexityScore || 0), 0) / analyzed.length : 0;
      const avgQuality = analyzed.length ? analyzed.reduce((acc, s) => acc + (s.analysis.readabilityScore || 0), 0) / analyzed.length : 0;
      const topicCount = coveredTopics[user.username]?.size || 0;
      const totalHierarchyProblems = userTotalHierarchyProblems[user.username] || 0;

      return {
        username: user.username,
        displayName: user.displayName,
        totalSubmissions: userSubs.length,
        analyzedCount: analyzed.length,
        totalScore: Number(totalScore.toFixed(1)),
        avgScore: Number(avgScore.toFixed(1)),
        avgTime: Number(avgTime.toFixed(1)),
        avgSpace: Number(avgSpace.toFixed(1)),
        avgQuality: Number(avgQuality.toFixed(1)),
        topicCount,
        totalHierarchyProblems,
        topicPercentage: Math.round((topicCount / (hierarchyTopics.length || 1)) * 100),
      };
    });
  }, [users, submissions, coveredTopics, hierarchyTopics, userTotalHierarchyProblems]);

  // Max score for SVG scaling
  const maxCumulativeScore = useMemo(() => {
    let maxVal = 100;
    trajectoryData.forEach(d => {
      if (d.finalScore > maxVal) maxVal = d.finalScore;
    });
    return Math.ceil(maxVal / 20) * 20;
  }, [trajectoryData]);

  // Filtered topics for Matrix view
  const filteredTopics = useMemo(() => {
    if (matrixFilter === 'all') return hierarchyTopics;
    return hierarchyTopics.filter(topic => {
      const isCoveredByAny = users.some(u => coveredTopics[u.username]?.has(topic));
      return matrixFilter === 'covered' ? isCoveredByAny : !isCoveredByAny;
    });
  }, [hierarchyTopics, matrixFilter, users, coveredTopics]);

  // Ranked users by final score for the podium banner
  const rankedByScore = useMemo(() => {
    return [...userMetrics].sort((a, b) => b.totalScore - a.totalScore);
  }, [userMetrics]);

  // SVG dimensions
  const svgWidth = 840;
  const svgHeight = 320;
  const padding = { top: 25, right: 35, bottom: 40, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const getX = (index: number) => {
    if (timelineDates.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (timelineDates.length - 1)) * graphWidth;
  };

  const getY = (score: number) => {
    return padding.top + graphHeight - (score / maxCumulativeScore) * graphHeight;
  };

  // Generate smooth SVG curve path using cubic Bezier curves
  const buildSmoothPath = (points: Array<{ cumulativeScore: number }>) => {
    if (!points.length) return '';
    const coords = points.map((p, i) => ({ x: getX(i), y: getY(p.cumulativeScore) }));
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? i : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  return (
    <div
      className="w-full rounded-2xl p-4 sm:p-6 mb-8 text-white flex flex-col gap-5"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg sm:text-xl font-black tracking-wide text-white">
              Competitive Analytics
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Winter Arc
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time trajectory, topic mastery from hierarchy.json &amp; head-to-head metrics
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Score Race</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Topic Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('head2head')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'head2head'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Head-to-Head</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SCORE RACE (TIMELINE SVG) */}
      {activeTab === 'timeline' && (
        <div className="flex flex-col gap-4">
          {/* User Filter / Legend */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs text-slate-500 mr-1">Filter Line:</span>
            {users.map(u => {
              const colors = getUserColors(u.username);
              const isSelected = highlightedUser === u.username;
              const isAnyHighlighted = highlightedUser !== null;
              return (
                <button
                  key={u.username}
                  onClick={() => setHighlightedUser(isSelected ? null : u.username)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'ring-2 ring-white/30 scale-105'
                      : isAnyHighlighted
                      ? 'opacity-40 hover:opacity-80'
                      : 'hover:brightness-125'
                  }`}
                  style={{
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.stroke,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: colors.stroke }}
                  />
                  <span>{u.displayName}</span>
                </button>
              );
            })}
            {highlightedUser && (
              <button
                onClick={() => setHighlightedUser(null)}
                className="text-[11px] text-slate-400 hover:text-white underline ml-1"
              >
                Reset
              </button>
            )}
          </div>

          {/* SVG Container */}
          <div className="relative w-full overflow-x-auto custom-scrollbar bg-black/25 rounded-xl border border-white/5 p-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full min-w-[620px] h-auto select-none"
            >
              <defs>
                {/* Glow filters for lines */}
                {users.map(u => {
                  const colors = getUserColors(u.username);
                  return (
                    <filter key={`glow-${u.username}`} id={`glow-${u.username}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  );
                })}
              </defs>

              {/* Grid Lines (Horizontal) */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const scoreVal = Math.round(maxCumulativeScore * pct);
                const yPos = getY(scoreVal);
                return (
                  <g key={`grid-${idx}`}>
                    <line
                      x1={padding.left}
                      y1={yPos}
                      x2={svgWidth - padding.right}
                      y2={yPos}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 10}
                      y={yPos + 4}
                      fill="rgba(148, 163, 184, 0.6)"
                      fontSize="10"
                      textAnchor="end"
                    >
                      {scoreVal}
                    </text>
                  </g>
                );
              })}

              {/* Date Ticks (Vertical) */}
              {timelineDates.map((date, idx) => {
                const xPos = getX(idx);
                const isShort = timelineDates.length > 8;
                const shouldShowLabel = !isShort || idx % 2 === 0 || idx === timelineDates.length - 1;
                const dayMonth = date.replace('2026-', '');
                return (
                  <g key={`x-tick-${idx}`}>
                    <line
                      x1={xPos}
                      y1={padding.top}
                      x2={xPos}
                      y2={svgHeight - padding.bottom}
                      stroke="rgba(255,255,255,0.03)"
                    />
                    {shouldShowLabel && (
                      <text
                        x={xPos}
                        y={svgHeight - padding.bottom + 18}
                        fill="rgba(148, 163, 184, 0.6)"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {dayMonth}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Trajectory Curves */}
              {trajectoryData.map(({ user, points }) => {
                const colors = getUserColors(user.username);
                const pathStr = buildSmoothPath(points);
                const isDimmed = highlightedUser && highlightedUser !== user.username;
                const isFocused = highlightedUser === user.username;

                return (
                  <g key={user.username} opacity={isDimmed ? 0.15 : 1} className="transition-opacity duration-200">
                    {/* Shadow / Glow line */}
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={isFocused ? 4.5 : 2.5}
                      filter={`url(#glow-${user.username})`}
                      opacity={0.6}
                    />
                    {/* Main crisp line */}
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={isFocused ? 3.5 : 2}
                    />

                    {/* Data Points */}
                    {points.map((pt, pIdx) => {
                      const cx = getX(pIdx);
                      const cy = getY(pt.cumulativeScore);
                      return (
                        <circle
                          key={`pt-${user.username}-${pIdx}`}
                          cx={cx}
                          cy={cy}
                          r={isFocused ? 4.5 : 3.5}
                          fill={colors.fill}
                          stroke="#0f0f1e"
                          strokeWidth="2"
                          className="cursor-pointer transition-transform hover:scale-150"
                          onMouseEnter={() =>
                            setHoveredPoint({
                              x: cx,
                              y: cy,
                              date: pt.date,
                              username: user.username,
                              score: pt.cumulativeScore,
                              dayScore: pt.dayScore,
                            })
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            <AnimatePresence>
              {hoveredPoint && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl text-xs bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-md"
                  style={{
                    left: Math.min(hoveredPoint.x + 12, svgWidth - 160),
                    top: Math.max(hoveredPoint.y - 45, 10),
                  }}
                >
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    {avatars[hoveredPoint.username] && (
                      <img
                        src={avatars[hoveredPoint.username]}
                        alt="avatar"
                        className="w-3.5 h-3.5 rounded-full object-cover"
                      />
                    )}
                    <span>{users.find(u => u.username === hoveredPoint.username)?.displayName}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Date: <span className="text-slate-200">{hoveredPoint.date}</span>
                  </div>
                  <div className="text-[11px] text-indigo-300 font-bold">
                    Cumulative: {hoveredPoint.score} pts
                    {hoveredPoint.dayScore > 0 && (
                      <span className="text-emerald-400 font-normal ml-1">
                        (+{hoveredPoint.dayScore.toFixed(1)})
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Current Standing Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {rankedByScore.map((user, idx) => {
              const colors = getUserColors(user.username);
              const medals = ['🥇', '🥈', '🥉', '4th'];
              const leaderScore = rankedByScore[0].totalScore;
              const delta = idx === 0 ? 'Leader' : `-${(leaderScore - user.totalScore).toFixed(1)} pts`;

              return (
                <div
                  key={user.username}
                  className="rounded-xl p-3 flex items-center justify-between gap-2"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none">{medals[idx]}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-white truncate">{user.displayName}</p>
                      <p className="text-[10px] text-slate-400">{delta}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm sm:text-base text-white">{user.totalScore}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TOPIC COVERAGE MATRIX & GITHUB-STYLE HEATMAP */}
      {activeTab === 'matrix' && (
        <div className="flex flex-col gap-4">
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-black/25 p-3 rounded-xl border border-white/5">
            {/* Filter buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold mr-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter:</span>
              </div>
              <button
                onClick={() => setMatrixFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  matrixFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                All Topics ({hierarchyTopics.length})
              </button>
              <button
                onClick={() => setMatrixFilter('covered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  matrixFilter === 'covered'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Covered by Any
              </button>
              <button
                onClick={() => setMatrixFilter('uncovered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  matrixFilter === 'uncovered'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Unmastered Gap
              </button>
            </div>

            {/* Axis Orientation Toggle */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10 self-start md:self-auto">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-wider">Axis:</span>
              <button
                onClick={() => setMatrixOrientation('topics-rows')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  matrixOrientation === 'topics-rows'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Y-Axis: Topics, X-Axis: Participants"
              >
                <Rows className="w-3 h-3" />
                <span>Topic Rows</span>
              </button>
              <button
                onClick={() => setMatrixOrientation('participants-rows')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  matrixOrientation === 'participants-rows'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Y-Axis: Participants, X-Axis: Topics (GitHub Commit Calendar view)"
              >
                <Columns className="w-3 h-3" />
                <span>Participant Rows</span>
              </button>
            </div>
          </div>

          {/* User Topic Count & Solved Problem Volume Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {userMetrics.map(u => {
              const colors = getUserColors(u.username);
              return (
                <div
                  key={u.username}
                  className="p-3 rounded-xl flex flex-col gap-2 transition-all hover:brightness-110"
                  style={{
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2 min-w-0">
                      {avatars[u.username] ? (
                        <img
                          src={avatars[u.username]}
                          alt={u.username}
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                          style={{ backgroundColor: colors.stroke }}
                        >
                          {u.displayName[0]}
                        </div>
                      )}
                      <span className="text-white truncate">{u.displayName}</span>
                    </div>
                    <span className="font-bold text-xs shrink-0" style={{ color: colors.stroke }}>
                      {u.topicCount} / {hierarchyTopics.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="text-slate-400">Challenge Solved:</span>
                    <span className="font-semibold text-white">
                      {userTotalHierarchyProblems[u.username] || 0} problems
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${u.topicPercentage}%`,
                        backgroundColor: colors.stroke,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* VIEW 1: TOPIC ROWS (Table View with Weighted Commit Cells) */}
          {matrixOrientation === 'topics-rows' && (
            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-white/10 bg-black/25">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-400">
                    <th className="py-3 px-4 font-semibold min-w-[200px]">Topic (from hierarchy.json)</th>
                    {users.map(u => (
                      <th key={u.username} className="py-3 px-3 font-semibold text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-1.5">
                          {avatars[u.username] && (
                            <img
                              src={avatars[u.username]}
                              alt={u.username}
                              className="w-4 h-4 rounded-full object-cover shrink-0"
                            />
                          )}
                          <span className="truncate">{u.displayName}</span>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-3 font-semibold text-center min-w-[80px]">Team Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTopics.map((topic, idx) => {
                    const teamSum = topicTeamTotals[topic] || 0;
                    return (
                      <tr
                        key={topic}
                        className="hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-200">
                          <span className="text-slate-500 mr-2 text-[10px]">{idx + 1}.</span>
                          <span className="hover:text-indigo-400 transition-colors">{topic}</span>
                        </td>
                        {users.map(u => {
                          const stat = topicStats[u.username]?.[topic] || { count: 0, problems: [] };
                          const style = getCellWeightStyle(u.username, stat.count);
                          const isHovered =
                            hoveredCell?.username === u.username && hoveredCell?.topic === topic;

                          return (
                            <td key={u.username} className="py-2 px-3 text-center">
                              <button
                                onMouseEnter={() =>
                                  setHoveredCell({
                                    username: u.username,
                                    displayName: u.displayName,
                                    topic,
                                    count: stat.count,
                                    problems: stat.problems,
                                  })
                                }
                                onClick={() =>
                                  setHoveredCell({
                                    username: u.username,
                                    displayName: u.displayName,
                                    topic,
                                    count: stat.count,
                                    problems: stat.problems,
                                  })
                                }
                                className={`inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-9 rounded-lg text-xs font-bold transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer select-none ${
                                  isHovered ? 'ring-2 ring-white scale-110 z-10' : ''
                                }`}
                                style={{
                                  backgroundColor: style.bg,
                                  border: style.border,
                                  color: style.text,
                                  boxShadow: style.boxShadow,
                                }}
                                title={`${u.displayName}: ${stat.count} problems solved in ${topic}`}
                              >
                                {stat.count === 0 ? <span className="opacity-30">—</span> : stat.count}
                              </button>
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-semibold ${
                              teamSum > 0
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                : 'text-slate-600 bg-white/[0.02]'
                            }`}
                          >
                            {teamSum > 0 ? `${teamSum} probs` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: PARTICIPANT ROWS (Authentic GitHub Contribution Rows View) */}
          {matrixOrientation === 'participants-rows' && (
            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="min-w-[860px] flex flex-col gap-3">
                {/* Topic Index Header Row */}
                <div className="flex items-center gap-2 pb-1 border-b border-white/5 text-[11px] text-slate-400">
                  <div className="w-48 shrink-0 font-semibold text-slate-300">
                    Participant &amp; Depth
                  </div>
                  <div
                    className="flex-1 gap-1.5 text-center"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${filteredTopics.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {filteredTopics.map((topic, i) => (
                      <div
                        key={topic}
                        className="text-[10px] text-slate-500 hover:text-white cursor-help font-mono truncate"
                        title={`${i + 1}. ${topic}`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <div className="w-16 shrink-0 text-right font-semibold text-slate-300">
                    Total
                  </div>
                </div>

                {/* Participant Rows */}
                {users.map(u => {
                  const colors = getUserColors(u.username);
                  const totalSolved = userTotalHierarchyProblems[u.username] || 0;

                  return (
                    <div
                      key={u.username}
                      className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                    >
                      {/* Left: Participant info */}
                      <div className="w-48 shrink-0 flex items-center gap-2.5 min-w-0">
                        {avatars[u.username] ? (
                          <img
                            src={avatars[u.username]}
                            alt={u.username}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                            style={{ backgroundColor: colors.stroke }}
                          >
                            {u.displayName[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-white truncate">{u.displayName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {coveredTopics[u.username]?.size || 0}/24 topics
                          </p>
                        </div>
                      </div>

                      {/* Middle: Weighted Commit Blocks */}
                      <div
                        className="flex-1 gap-1.5"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${filteredTopics.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {filteredTopics.map(topic => {
                          const stat = topicStats[u.username]?.[topic] || { count: 0, problems: [] };
                          const style = getCellWeightStyle(u.username, stat.count);
                          const isHovered =
                            hoveredCell?.username === u.username && hoveredCell?.topic === topic;

                          return (
                            <button
                              key={topic}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  username: u.username,
                                  displayName: u.displayName,
                                  topic,
                                  count: stat.count,
                                  problems: stat.problems,
                                })
                              }
                              onClick={() =>
                                setHoveredCell({
                                  username: u.username,
                                  displayName: u.displayName,
                                  topic,
                                  count: stat.count,
                                  problems: stat.problems,
                                })
                              }
                              className={`aspect-square w-full rounded-[5px] flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-125 cursor-pointer ${
                                isHovered ? 'ring-2 ring-white scale-125 z-10' : ''
                              }`}
                              style={{
                                backgroundColor: style.bg,
                                border: style.border,
                                color: style.text,
                                boxShadow: style.boxShadow,
                              }}
                              title={`${topic}: ${stat.count} problems solved by ${u.displayName}`}
                            >
                              {stat.count > 0 ? stat.count : ''}
                            </button>
                          );
                        })}
                      </div>

                      {/* Right: Total Badge */}
                      <div className="w-16 shrink-0 text-right">
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-black"
                          style={{
                            color: colors.stroke,
                            backgroundColor: colors.bg,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {totalSolved}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Inspection Card */}
          {hoveredCell ? (
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                {avatars[hoveredCell.username] ? (
                  <img
                    src={avatars[hoveredCell.username]}
                    alt="avatar"
                    className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                    style={{ backgroundColor: getUserColors(hoveredCell.username).stroke }}
                  >
                    {hoveredCell.displayName[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white">{hoveredCell.displayName}</p>
                    <span className="text-xs text-slate-500">•</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        color: getUserColors(hoveredCell.username).stroke,
                        backgroundColor: getUserColors(hoveredCell.username).bg,
                        border: `1px solid ${getUserColors(hoveredCell.username).border}`,
                      }}
                    >
                      {hoveredCell.topic}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {hoveredCell.count === 0 ? (
                      <span className="text-slate-500">Unexplored topic • 0 problems submitted yet.</span>
                    ) : (
                      <>
                        <span className="font-semibold text-white">{hoveredCell.count} problem{hoveredCell.count > 1 ? 's' : ''}</span>{' '}
                        implemented &amp; verified by AI analyzer
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Solved Problems Pills */}
              {hoveredCell.problems.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap max-w-md sm:justify-end">
                  {hoveredCell.problems.slice(0, 4).map(p => (
                    <span
                      key={p}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-200 truncate max-w-[150px]"
                      title={p}
                    >
                      {p}
                    </span>
                  ))}
                  {hoveredCell.problems.length > 4 && (
                    <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-1 rounded-md border border-white/5">
                      +{hoveredCell.problems.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-500 flex items-center justify-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Hover or click on any weighted block to inspect specific problems solved by participant</span>
            </div>
          )}

          {/* GitHub-Style Weighted Legend */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-400 pt-1 pb-1 gap-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px] font-semibold">Commit Weight:</span>
              <span className="text-[11px] text-slate-500">Less</span>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded bg-white/[0.03] border border-white/10 flex items-center justify-center text-[9px] text-slate-600 font-bold"
                  title="0 problems"
                >
                  —
                </div>
                <div
                  className="w-4 h-4 rounded bg-indigo-500/25 border border-indigo-500/40 flex items-center justify-center text-[9px] text-indigo-200 font-bold"
                  title="1-2 problems (Tier 1)"
                >
                  1
                </div>
                <div
                  className="w-4 h-4 rounded bg-indigo-500/50 border border-indigo-500/65 flex items-center justify-center text-[9px] text-white font-bold"
                  title="3-5 problems (Tier 2)"
                >
                  3
                </div>
                <div
                  className="w-4 h-4 rounded bg-indigo-500/75 border border-indigo-500/90 shadow-[0_0_8px_rgba(99,102,241,0.35)] flex items-center justify-center text-[9px] text-white font-bold"
                  title="6-10 problems (Tier 3)"
                >
                  7
                </div>
                <div
                  className="w-4 h-4 rounded bg-indigo-500 border border-white shadow-[0_0_12px_rgba(99,102,241,0.6)] flex items-center justify-center text-[9px] text-white font-bold"
                  title="11+ problems (Tier 4)"
                >
                  12
                </div>
              </div>
              <span className="text-[11px] text-slate-500">More</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Color weight scales dynamically with unique LeetCode problems solved per hierarchy topic
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HEAD-TO-HEAD PILLARS */}
      {activeTab === 'head2head' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Metric 1: Topic Diversity */}
            <div className="p-4 rounded-xl bg-black/25 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  🎯 Topic Diversity
                </span>
                <span className="text-[11px] text-slate-500">Out of 24 canonical DSA topics</span>
              </div>
              <div className="flex flex-col gap-2">
                {[...userMetrics]
                  .sort((a, b) => b.topicCount - a.topicCount)
                  .map((u, i) => {
                    const colors = getUserColors(u.username);
                    return (
                      <div key={u.username} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-white flex items-center gap-1.5">
                            {i === 0 && <span title="Category Leader">👑</span>}
                            {u.displayName}
                          </span>
                          <span className="font-bold" style={{ color: colors.stroke }}>
                            {u.topicCount} topics ({u.topicPercentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(u.topicCount / 24) * 100}%`,
                              backgroundColor: colors.stroke,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Metric 2: Average AI Score */}
            <div className="p-4 rounded-xl bg-black/25 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                  ⭐ Average AI Score
                </span>
                <span className="text-[11px] text-slate-500">Weighted LangGraph evaluation / 10</span>
              </div>
              <div className="flex flex-col gap-2">
                {[...userMetrics]
                  .sort((a, b) => b.avgScore - a.avgScore)
                  .map((u, i) => {
                    const colors = getUserColors(u.username);
                    return (
                      <div key={u.username} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-white flex items-center gap-1.5">
                            {i === 0 && <span title="Category Leader">👑</span>}
                            {u.displayName}
                          </span>
                          <span className="font-bold" style={{ color: colors.stroke }}>
                            {u.avgScore} / 10
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(u.avgScore / 10) * 100}%`,
                              backgroundColor: colors.stroke,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Metric 3: Time Complexity Efficiency */}
            <div className="p-4 rounded-xl bg-black/25 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  ⚡ Time Efficiency Score
                </span>
                <span className="text-[11px] text-slate-500">Big-O optimal performance</span>
              </div>
              <div className="flex flex-col gap-2">
                {[...userMetrics]
                  .sort((a, b) => b.avgTime - a.avgTime)
                  .map((u, i) => {
                    const colors = getUserColors(u.username);
                    return (
                      <div key={u.username} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-white flex items-center gap-1.5">
                            {i === 0 && <span title="Category Leader">👑</span>}
                            {u.displayName}
                          </span>
                          <span className="font-bold" style={{ color: colors.stroke }}>
                            {u.avgTime} / 10
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(u.avgTime / 10) * 100}%`,
                              backgroundColor: colors.stroke,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Metric 4: Readability & Clean Code */}
            <div className="p-4 rounded-xl bg-black/25 border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  📖 Code Quality &amp; Cleanliness
                </span>
                <span className="text-[11px] text-slate-500">Readability and maintainability</span>
              </div>
              <div className="flex flex-col gap-2">
                {[...userMetrics]
                  .sort((a, b) => b.avgQuality - a.avgQuality)
                  .map((u, i) => {
                    const colors = getUserColors(u.username);
                    return (
                      <div key={u.username} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-white flex items-center gap-1.5">
                            {i === 0 && <span title="Category Leader">👑</span>}
                            {u.displayName}
                          </span>
                          <span className="font-bold" style={{ color: colors.stroke }}>
                            {u.avgQuality} / 10
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(u.avgQuality / 10) * 100}%`,
                              backgroundColor: colors.stroke,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
