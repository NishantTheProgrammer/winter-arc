"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

const MIN_DATE = new Date(2026, 9, 1); // Oct 2026
const MAX_DATE = new Date(2026, 11, 1); // Dec 2026

interface CalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const Calendar = ({ selectedDate, onSelectDate }: CalendarProps) => {
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m, d] = selectedDate.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1);
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      // Fetch submissions
      const subSnap = await getDocs(collection(db, 'submissions'));
      setSubmissions(subSnap.docs.map(doc => doc.data()));

      // Fetch participants for avatars
      const partSnap = await getDocs(collection(db, 'participants'));
      const avatarMap: Record<string, string> = {};
      partSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.username && data.avatar) {
          avatarMap[data.username] = data.avatar;
        }
      });
      setAvatars(avatarMap);
    }
    fetchData();
  }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => {
    if (currentDate > MIN_DATE) {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };
  
  const nextMonth = () => {
    if (currentDate < MAX_DATE) {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const getWinnerForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const daySubs = submissions.filter(s => s.date === dateStr && s.analysis && s.analysis.aggregatedScore != null);
    if (daySubs.length === 0) return null;
    return daySubs.reduce((prev, current) => (prev.analysis.aggregatedScore > current.analysis.aggregatedScore) ? prev : current);
  };

  return (
    <div className="glass rounded-2xl p-6 text-white w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={prevMonth} 
          disabled={currentDate <= MIN_DATE}
          className={`p-2 rounded-full transition-colors ${currentDate <= MIN_DATE ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'}`}
        >
          <ChevronLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h2 className="text-lg font-bold tracking-wide">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <button 
          onClick={nextMonth} 
          disabled={currentDate >= MAX_DATE}
          className={`p-2 rounded-full transition-colors ${currentDate >= MAX_DATE ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'}`}
        >
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day}>{day}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {padding.map(p => <div key={`pad-${p}`} className="h-10 w-10 md:h-12 md:w-12"></div>)}
        {days.map(day => {
          const winner = getWinnerForDay(day);
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDate === dateStr;
          
          return (
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              key={day} 
              onClick={() => onSelectDate(dateStr)}
              className={`relative h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl text-sm font-semibold cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#0f0f1e] scale-105 z-20 ' : ''
              } ${
                winner 
                  ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                  : 'bg-white/5 border border-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
              }`}
            >
              <span>{day}</span>
              {winner && avatars[winner.username] && (
                <img 
                  src={avatars[winner.username]} 
                  alt={winner.username}
                  title={`${winner.username} won with ${winner.analysis.aggregatedScore.toFixed(1)}/10`}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 md:w-6 md:h-6 rounded-full border border-indigo-500 shadow-md object-cover z-10 bg-[#1e1e1e]"
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
