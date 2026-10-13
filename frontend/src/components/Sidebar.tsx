'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileCode2,
  Flame,
  Zap,
  Menu,
  X,
  Settings,
  Calculator,
  Info,
  Scale,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ShieldCheck,
  Code2,
  Layers,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/',               label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/system-design',  label: 'System Design', icon: Layers },
  { href: '/users',          label: 'Users',         icon: Users },
  { href: '/submissions',    label: 'Submissions',   icon: FileCode2 },
  { href: '/settings',       label: 'Settings',      icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const [showScoringModal, setShowScoringModal] = useState(false);

  const sidebarContent = (
    <aside
      className="flex flex-col h-full w-64"
      style={{
        background: 'rgba(15,15,30,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5 shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
        >
          <Flame className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white tracking-wide">Winter Arc</p>
          <p className="text-xs text-slate-500">LeetCode Tracker</p>
        </div>
      </div>

      {/* Scrollable Center: Nav + Scoring Info */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-4">
        {/* Nav */}
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: active ? '#818cf8' : '#94a3b8',
                  border: active ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Scoring Guide Widget */}
        <div
          className="rounded-xl p-3 text-xs flex flex-col gap-2.5"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Calculator className="w-3.5 h-3.5 text-indigo-400" />
              <span>Scoring System</span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              0 - 10 Pts
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            AI evaluates solutions on 3 core pillars normalized dynamically:
          </p>

          {/* 3 Pillars Breakdown */}
          <div className="space-y-2">
            {/* Pillar 1: Efficiency */}
            <div>
              <div className="flex justify-between text-[11px] font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Efficiency
                </span>
                <span className="font-bold text-indigo-300">70%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                  style={{ width: '70%' }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                <span>Time (45%)</span>
                <span>Space (25%)</span>
              </div>
            </div>

            {/* Pillar 2: Quality */}
            <div>
              <div className="flex justify-between text-[11px] font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Code Quality
                </span>
                <span className="font-bold text-purple-300">20%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400"
                  style={{ width: '20%' }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                <span>Read (10%)</span>
                <span>Maint (5%) • Simp (5%)</span>
              </div>
            </div>

            {/* Pillar 3: Robustness */}
            <div>
              <div className="flex justify-between text-[11px] font-medium text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Robustness
                </span>
                <span className="font-bold text-emerald-300">10%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: '10%' }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                <span>Edge Cases (7%)</span>
                <span>Error Handling (3%)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowScoringModal(true)}
            className="w-full py-1.5 px-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-[11px] font-medium text-indigo-300 hover:text-white transition-colors border border-indigo-500/20 flex items-center justify-center gap-1.5 mt-1"
          >
            <Info className="w-3 h-3 text-indigo-400" />
            <span>How Scoring Calculates</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Zap className="w-3 h-3 text-indigo-500 shrink-0" />
          <span>Powered by Ollama + LangGraph</span>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop: always-visible fixed sidebar ── */}
      <div className="hidden lg:block fixed top-0 left-0 h-full w-64 z-50">
        {sidebarContent}
      </div>

      {/* ── Mobile: top header bar with hamburger ── */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(15,15,30,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          >
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-white tracking-wide">Winter Arc</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile: backdrop overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in drawer ── */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full z-50 w-64 transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative h-full">
          {sidebarContent}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Scoring Rubric Modal ── */}
      <AnimatePresence>
        {showScoringModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowScoringModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar rounded-2xl bg-[#0f0f1e] border border-white/10 shadow-2xl p-5 sm:p-7 text-white flex flex-col gap-6 z-10"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.1)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
                  >
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                      Winter Arc Scoring Rubric
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        0 - 10 Scale
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      How AI objectively evaluates every LeetCode submission
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowScoringModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mathematical Formula Banner */}
              <div
                className="p-4 rounded-xl flex flex-col gap-2.5"
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Dynamic Weight Formula
                  </span>
                  <span className="text-[11px] text-slate-400">Total max = 10.0 pts</span>
                </div>
                <div className="bg-black/40 p-2.5 rounded-lg font-mono text-[11px] sm:text-xs text-slate-200 border border-white/5 overflow-x-auto">
                  Score = [ (Time×45 + Space×25) + (Read×10 + Simp×5 + Maint×5) + (Edge×7 + Error×3) ] / 100
                </div>
                <p className="text-[11px] text-slate-400">
                  Calculated dynamically at runtime from raw sub-scores so weight updates take effect instantly.
                </p>
              </div>

              {/* 3 Pillars Breakdown Cards */}
              <div className="flex flex-col gap-4">
                {/* Pillar 1: Efficiency */}
                <div
                  className="p-4 rounded-xl flex flex-col gap-2.5"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400" />
                      <h3 className="font-bold text-sm text-white">1. Algorithmic Efficiency</h3>
                    </div>
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                      70% Total Weight
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Time Complexity</span>
                        <span className="text-indigo-400 font-bold text-xs">45%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Evaluates Big-O vs theoretical optimal lower bound (e.g., O(N) vs O(N²)), loop boundary safety, and constant-factor overhead.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Space Complexity</span>
                        <span className="text-indigo-400 font-bold text-xs">25%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Evaluates auxiliary memory consumption. O(1) in-place receives 10/10; redundant arrays or buffers are penalized.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pillar 2: Code Quality */}
                <div
                  className="p-4 rounded-xl flex flex-col gap-2.5"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-purple-400" />
                      <h3 className="font-bold text-sm text-white">2. Code Quality</h3>
                    </div>
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20">
                      20% Total Weight
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Readability</span>
                        <span className="text-purple-400 font-bold text-xs">10%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Clear naming conventions, clean control flow, and idiomatic language practices.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Maintainability</span>
                        <span className="text-purple-400 font-bold text-xs">5%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Modular structure and separation of concerns.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Simplicity</span>
                        <span className="text-purple-400 font-bold text-xs">5%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Concise logic without redundant variables or over-engineering.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pillar 3: Correctness & Robustness */}
                <div
                  className="p-4 rounded-xl flex flex-col gap-2.5"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-sm text-white">3. Correctness &amp; Robustness</h3>
                    </div>
                    <span className="font-black text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                      10% Total Weight
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Edge Cases</span>
                        <span className="text-emerald-400 font-bold text-xs">7%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Safe behavior for boundary inputs (empty lists, single elements, negative numbers, extreme inputs).
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">Error Handling &amp; Safety</span>
                        <span className="text-emerald-400 font-bold text-xs">3%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Array bounds safety (e.g. preventing off-by-one errors like i &lt;= length), overflow safety, and avoidance of undefined access.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Why LeetCode Accepted != 10/10 Callout */}
                <div
                  className="p-3.5 rounded-xl flex items-start gap-3 text-xs"
                  style={{
                    background: 'rgba(245, 158, 11, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300 text-xs mb-0.5">
                      Why does LeetCode Acceptance not guarantee a 10/10?
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      LeetCode only checks whether test cases produce matching output. The Winter Arc AI evaluator inspects actual algorithm design: sub-optimal Big-O, constant factor bloat, memory waste, and off-by-one bounds defects that silently pass in loosely typed languages (like JS returning undefined) are rightfully caught and penalized.
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button Footer */}
              <div className="flex justify-end pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowScoringModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/30"
                >
                  Got it, close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
