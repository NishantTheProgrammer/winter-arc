'use client';

import { useTheme } from '@/components/ThemeProvider';
import { Palette, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const THEMES = [
  {
    id: 'default',
    name: 'Twilight (Default)',
    colors: ['#4f46e5', '#9333ea'], // Indigo & Purple
    description: 'The default Winter Arc dark theme.'
  },
  {
    id: 'emerald',
    name: 'Aurora',
    colors: ['#10b981', '#06b6d4'], // Emerald & Cyan
    description: 'A vibrant, energetic green and cyan vibe.'
  },
  {
    id: 'rose',
    name: 'Sunset',
    colors: ['#e11d48', '#f59e0b'], // Rose & Amber
    description: 'Warm colors resembling a sunset.'
  },
  {
    id: 'monochrome',
    name: 'Stealth',
    colors: ['#64748b', '#334155'], // Slate
    description: 'A quiet, distraction-free monochrome look.'
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    colors: ['#3b82f6', '#06b6d4'],
    description: 'Cool blue and cyan aquatic tones.'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: ['#db2777', '#eab308'],
    description: 'High-contrast neon pink and yellow.'
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: ['#15803d', '#84cc16'],
    description: 'Earthy green and lime accents.'
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    colors: ['#7e22ce', '#4338ca'],
    description: 'Deep purple and rich indigo tones.'
  }
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text flex items-center gap-3"
          style={{ backgroundImage: 'linear-gradient(90deg, #818cf8, #a855f7, #ec4899)' }}
        >
          <Palette className="w-8 h-8 text-indigo-400" />
          Settings
        </h1>
        <p className="text-slate-500 mt-2 text-sm">Customize your dashboard experience.</p>
      </div>

      <div className="space-y-8">
        {/* Theme Selection Section */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">Appearance / Theme</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative p-4 rounded-xl flex items-center gap-4 text-left transition-all duration-200 border ${
                    isActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {/* Color Preview Swatch */}
                  <div 
                    className="w-12 h-12 rounded-lg shrink-0 shadow-inner"
                    style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-sm ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                      {t.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {t.description}
                    </p>
                  </div>

                  {isActive && (
                    <div className="absolute top-4 right-4 text-indigo-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
