import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange, CalendarClock } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

type ViewMode = 'month' | 'week' | 'day';

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const monthDays = useMemo(() => {
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentDate]);

  const weekDates = useMemo(() => {
    const today = new Date(currentDate);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + i + (weekOffset * 7));
      return d;
    });
  }, [currentDate, weekOffset]);

  const formatDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0];
  };

  const formatDateFromDate = (d: Date) => {
    return d.toISOString().split('T')[0];
  };

  const isInRange = (dateStr: string): boolean => {
    if (!startDate || !endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isSelected = (dateStr: string): boolean => {
    return dateStr === startDate || dateStr === endDate;
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (selectingStart) {
      onStartDateChange(dateStr);
      if (!endDate || dateStr > endDate) {
        setSelectingStart(false);
      }
    } else {
      if (dateStr >= startDate) {
        onEndDateChange(dateStr);
        setSelectingStart(true);
      }
    }
  };

  const handleDateClick = (d: Date) => {
    const dateStr = formatDateFromDate(d);
    if (selectingStart) {
      onStartDateChange(dateStr);
      if (!endDate || dateStr > endDate) {
        setSelectingStart(false);
      }
    } else {
      if (dateStr >= startDate) {
        onEndDateChange(dateStr);
        setSelectingStart(true);
      }
    }
  };

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const shortDayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  const navigatePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    } else if (viewMode === 'week') {
      setWeekOffset(w => w - 1);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    } else if (viewMode === 'week') {
      setWeekOffset(w => w + 1);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const renderHeader = () => {
    let label = monthName;
    if (viewMode === 'week') {
      const first = weekDates[0];
      const last = weekDates[6];
      if (first.getMonth() === last.getMonth()) {
        label = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      } else {
        label = `${first.toLocaleDateString('es-ES', { month: 'short' })} - ${last.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`;
      }
    } else if (viewMode === 'day') {
      label = currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return label;
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-6 shadow-lg border border-[var(--border-light)]">
      {/* View mode tabs */}
      <div className="flex bg-[var(--bg-base)] rounded-xl p-1 mb-4">
        {([
          { id: 'month' as const, icon: CalendarDays, label: 'Mes' },
          { id: 'week' as const, icon: CalendarRange, label: 'Sem' },
          { id: 'day' as const, icon: CalendarClock, label: 'Día' },
        ]).map(v => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              onClick={() => { setViewMode(v.id); setWeekOffset(0); }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === v.id ? 'bg-[var(--bg-card)] text-primary shadow-sm' : 'text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={12} />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] capitalize">{renderHeader()}</h3>
        <div className="flex gap-1">
          <button onClick={navigatePrev} className="p-1 hover:bg-[var(--bg-base)] rounded-lg transition">
            <ChevronLeft size={18} className="text-[var(--text-muted)]" />
          </button>
          <button onClick={navigateNext} className="p-1 hover:bg-[var(--bg-base)] rounded-lg transition">
            <ChevronRight size={18} className="text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* Monthly View */}
      {viewMode === 'month' && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-3">
            {shortDayNames.map(day => (
              <div key={day} className="text-center text-xs font-bold text-[var(--text-muted)] py-2">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day);
              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square rounded-lg text-sm font-medium transition ${
                    isSelected(dateStr)
                      ? 'bg-pink-500 text-white shadow-md'
                      : isInRange(dateStr)
                      ? 'bg-pink-100 text-[var(--text-primary)]'
                      : 'bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Weekly View */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((d, idx) => {
            const dateStr = formatDateFromDate(d);
            const dayNum = d.getDate();
            return (
              <button
                key={idx}
                onClick={() => handleDateClick(d)}
                className={`flex flex-col items-center rounded-xl py-2 transition ${
                  isSelected(dateStr)
                    ? 'bg-pink-500 text-white shadow-md'
                    : isInRange(dateStr)
                    ? 'bg-pink-100 text-[var(--text-primary)]'
                    : 'bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-60">{shortDayNames[idx]}</span>
                <span className="text-sm font-bold mt-0.5">{dayNum}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Daily View */}
      {viewMode === 'day' && (
        <div className="flex flex-col items-center py-4">
          <div className="text-center mb-2">
            <span className="text-4xl font-bold text-[var(--text-primary)]">{currentDate.getDate()}</span>
            <p className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider">
              {currentDate.toLocaleDateString('es-ES', { weekday: 'long', month: 'long' })}
            </p>
          </div>
          <button
            onClick={() => handleDateClick(currentDate)}
            className={`mt-3 px-6 py-2 rounded-full text-sm font-bold transition ${
              isSelected(formatDateFromDate(currentDate))
                ? 'bg-pink-500 text-white shadow-md'
                : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
            }`}
          >
            {selectingStart ? 'Seleccionar como inicio' : 'Seleccionar como fin'}
          </button>
        </div>
      )}

      {/* Date display */}
      <div className="bg-[var(--bg-base)] rounded-xl p-4 space-y-2 mt-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Inicio</p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Seleccionar'}
          </p>
        </div>
        <div className="h-px bg-gray-200" />
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1">Fin</p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {endDate ? new Date(endDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Seleccionar'}
          </p>
        </div>
      </div>

      {/* Selection indicator */}
      <div className="mt-4 flex justify-center gap-1">
        <div className={`w-2 h-2 rounded-full transition ${selectingStart ? 'bg-pink-500' : 'bg-gray-300'}`} />
        <div className={`w-2 h-2 rounded-full transition ${!selectingStart ? 'bg-pink-500' : 'bg-gray-300'}`} />
      </div>
    </div>
  );
};

export default DateRangePicker;
