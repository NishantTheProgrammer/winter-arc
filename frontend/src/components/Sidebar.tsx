'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FileCode2, Flame, Zap, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/users',       label: 'Users',        icon: Users },
  { href: '/submissions', label: 'Submissions',  icon: FileCode2 },
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
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
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

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5">
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
    </>
  );
}
