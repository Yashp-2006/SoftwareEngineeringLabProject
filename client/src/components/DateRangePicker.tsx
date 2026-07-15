'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  value: string;
  onChange: (rangeStr: string, daysCount: number) => void;
}

// Helper to parse date string safely
const parseDateStr = (str: string): Date | null => {
  if (!str) return null;
  const parsed = Date.parse(str.trim());
  return isNaN(parsed) ? null : new Date(parsed);
};

// Robust date range parser supporting multiple formats:
// 1. YYYY-MM-DD to YYYY-MM-DD
// 2. Jul 10-12, 2026
// 3. Jul 10 - Jul 12, 2026
const parseInputRange = (str: string): { start: Date | null; end: Date | null; daysCount: number } => {
  if (!str) return { start: null, end: null, daysCount: 1 };

  const separators = [' to ', ' - ', ' – '];
  for (const sep of separators) {
    if (str.includes(sep)) {
      const parts = str.split(sep);
      const start = parseDateStr(parts[0]);
      const end = parseDateStr(parts[1]);
      if (start && end) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return { start, end, daysCount };
      }
    }
  }

  const rangeDashMatch = str.match(/^([a-zA-Z]+)\s+(\d+)-(\d+),\s+(\d{4})/);
  if (rangeDashMatch) {
    const monthStr = rangeDashMatch[1];
    const startDay = parseInt(rangeDashMatch[2]);
    const endDay = parseInt(rangeDashMatch[3]);
    const yearVal = parseInt(rangeDashMatch[4]);
    
    const start = parseDateStr(`${monthStr} ${startDay}, ${yearVal}`);
    const end = parseDateStr(`${monthStr} ${endDay}, ${yearVal}`);
    if (start && end) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return { start, end, daysCount };
    }
  }

  const single = parseDateStr(str);
  if (single) {
    return { start: single, end: single, daysCount: 1 };
  }

  return { start: null, end: null, daysCount: 1 };
};

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [inputValue, setInputValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync props value to internal input state & calendar selection
  useEffect(() => {
    setInputValue(value || '');
    if (!value) {
      // Only reset local selection state if calendar is not currently active/open
      if (!isOpen) {
        setStartDate(null);
        setEndDate(null);
      }
      return;
    }
    
    const { start, end } = parseInputRange(value);
    if (start) {
      setStartDate(start);
      // Auto-focus calendar view to the start date month
      setCurrentMonth(start);
    }
    if (end) {
      setEndDate(end);
    }
  }, [value, isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateRange = (start: Date, end: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startM = months[start.getMonth()];
    const startD = start.getDate();
    const startY = start.getFullYear();
    
    const endM = months[end.getMonth()];
    const endD = end.getDate();
    const endY = end.getFullYear();

    if (startY === endY) {
      if (startM === endM) {
        if (startD === endD) {
          return `${startM} ${startD}, ${startY}`;
        }
        return `${startM} ${startD}-${endD}, ${startY}`;
      }
      return `${startM} ${startD} - ${endM} ${endD}, ${startY}`;
    }
    return `${startM} ${startD}, ${startY} - ${endM} ${endD}, ${endY}`;
  };

  const getDaysCount = (start: Date, end: Date): number => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
      // Construct single-day string temporarily so parent receives update
      const rangeStr = formatDateRange(date, date);
      setInputValue(rangeStr);
    } else if (startDate && !endDate) {
      if (date < startDate) {
        setStartDate(date);
        const rangeStr = formatDateRange(date, date);
        setInputValue(rangeStr);
      } else {
        setEndDate(date);
        const rangeStr = formatDateRange(startDate, date);
        const count = getDaysCount(startDate, date);
        setInputValue(rangeStr);
        onChange(rangeStr, count);
        setIsOpen(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    if (!val.trim()) {
      setStartDate(null);
      setEndDate(null);
      onChange('', 1);
      return;
    }

    const { start, end, daysCount } = parseInputRange(val);
    if (start && end) {
      setStartDate(start);
      setEndDate(end);
      onChange(val, daysCount);
    } else {
      // Send raw typed value to parent immediately so form submission works
      onChange(val, 1);
    }
  };

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete grid (6 rows of 7 days)
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const isSelected = (date: Date) => {
    if (startDate && date.toDateString() === startDate.toDateString()) return 'start';
    if (endDate && date.toDateString() === endDate.toDateString()) return 'end';
    return null;
  };

  const isInRange = (date: Date) => {
    if (!startDate) return false;
    if (endDate) {
      return date > startDate && date < endDate;
    }
    if (hoveredDate) {
      return date > startDate && date < hoveredDate;
    }
    return false;
  };

  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div ref={containerRef} className="date-picker-container" style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          id="dates-input"
          data-testid="dates-input"
          className="input-field date-range-input"
          placeholder="Select competition dates..."
          value={inputValue}
          onChange={handleInputChange}
          onClick={() => setIsOpen(true)}
          style={{ cursor: 'pointer', paddingRight: '36px' }}
        />
        <Calendar
          size={16}
          className="calendar-icon"
          style={{ position: 'absolute', right: '12px', color: 'var(--neutral-500)', pointerEvents: 'none' }}
        />
      </div>

      {isOpen && (
        <div className="calendar-dropdown" data-testid="calendar-dropdown">
          <div className="calendar-header">
            <button
              type="button"
              className="cal-nav-btn prev-month-btn"
              data-testid="prev-month-btn"
              onClick={prevMonth}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="calendar-month-title" data-testid="calendar-month-title">
              {monthNames[month]} {year}
            </div>
            <button
              type="button"
              className="cal-nav-btn next-month-btn"
              data-testid="next-month-btn"
              onClick={nextMonth}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="weekday-cell">{d}</div>
            ))}
          </div>

          <div className="calendar-days-grid" data-testid="calendar-days-grid">
            {days.map(({ date, isCurrentMonth }, idx) => {
              const selectType = isSelected(date);
              const inRange = isInRange(date);
              
              let dayClass = 'day-cell';
              if (!isCurrentMonth) dayClass += ' day-outside';
              if (selectType === 'start') dayClass += ' day-selected-start';
              if (selectType === 'end') dayClass += ' day-selected-end';
              if (inRange) dayClass += ' day-in-range';

              // Unique datatestid for specific days of the month e.g., day-10, day-12
              const testId = `day-${isCurrentMonth ? '' : 'outside-'}${date.getDate()}`;

              return (
                <div
                  key={idx}
                  className={dayClass}
                  data-testid={testId}
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => startDate && !endDate && setHoveredDate(date)}
                >
                  <span className="day-number">{date.getDate()}</span>
                </div>
              );
            })}
          </div>
          <style>{`
            .calendar-dropdown {
              position: absolute;
              top: calc(100% + 6px);
              left: 0;
              z-index: 1050;
              width: 320px;
              background: var(--shiro);
              border: 1px solid var(--neutral-300);
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
              padding: 16px;
              animation: slideUpFade 180ms var(--ease-out);
            }

            @keyframes slideUpFade {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .calendar-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
            }

            .calendar-month-title {
              font-size: 14px;
              font-weight: 700;
              color: var(--neutral-900);
            }

            .cal-nav-btn {
              background: none;
              border: none;
              cursor: pointer;
              color: var(--neutral-600);
              padding: 4px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              transition: background-color 0.2s;
            }

            .cal-nav-btn:hover {
              background: var(--neutral-100);
              color: var(--neutral-900);
            }

            .calendar-weekdays {
              display: grid;
              grid-template-columns: repeat(7, 1fr);
              text-align: center;
              margin-bottom: 8px;
            }

            .weekday-cell {
              font-size: 11px;
              font-weight: 700;
              color: var(--neutral-400);
              text-transform: uppercase;
            }

            .calendar-days-grid {
              display: grid;
              grid-template-columns: repeat(7, 1fr);
              row-gap: 4px;
            }

            .day-cell {
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              font-size: 13px;
              font-weight: 500;
              position: relative;
              color: var(--neutral-800);
            }

            .day-cell:hover:not(.day-selected-start):not(.day-selected-end) {
              background: var(--neutral-100);
              border-radius: 50%;
            }

            .day-outside {
              color: var(--neutral-300);
            }

            .day-selected-start,
            .day-selected-end {
              background: var(--ao) !important;
              color: #fff !important;
              border-radius: 50%;
              font-weight: 700;
            }

            .day-in-range {
              background: rgba(26, 77, 181, 0.08);
              color: var(--ao);
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
