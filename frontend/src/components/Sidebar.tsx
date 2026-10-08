'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FileCode2, Flame, Zap } from 'lucide-react';

const navItems = [
  { href: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/users',       label: 'Users',        icon: Users },
  { href: '/submissions', label: 'Submissions',  icon: FileCode2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-full w-64 flex flex-col z-50"
      style={{
        background: 'rgba(15,15,30,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
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
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Zap className="w-3 h-3 text-indigo-500" />
          <span>Powered by Ollama + LangGraph</span>
        </div>
      </div>
    </aside>
  );
}
