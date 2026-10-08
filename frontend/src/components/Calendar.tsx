"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Dummy solved days for the UI
  const solvedDays = [3, 5, 6, 8, 12, 14, 15];

  return (
    <div className="glass rounded-2xl p-6 text-white w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h2 className="text-xl font-bold tracking-wide">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-gray-400">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day}>{day}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {padding.map(p => <div key={`pad-${p}`} className="h-10 w-10"></div>)}
        {days.map(day => {
          const isSolved = solvedDays.includes(day);
          return (
            <motion.div 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              key={day} 
              className={`h-10 w-10 flex items-center justify-center rounded-full text-sm cursor-pointer transition-all ${
                isSolved ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 font-bold shadow-lg shadow-indigo-500/30' : 'hover:bg-white/10 text-gray-300'
              }`}
            >
              {day}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
