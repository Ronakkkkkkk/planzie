import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Award, Trash2, Check, Flame } from 'lucide-react';
import { Habit } from '../types';

export function HabitsSection() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalYesterdayDateString = (d: Date) => {
    const yesterday = new Date(d);
    yesterday.setDate(yesterday.getDate() - 1);
    return getLocalDateString(yesterday);
  };

  const todayStr = getLocalDateString(new Date());
  const yesterdayStr = getLocalYesterdayDateString(new Date());

  const fetchHabits = async () => {
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch('/api/habits', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHabits(data);
      } else {
        setError('Failed to load habits');
      }
    } catch (err) {
      setError('Network error loading habits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAdding(true);
    setError('');

    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (res.ok) {
        const created = await res.json();
        setHabits((prev) => [created, ...prev]);
        setNewTitle('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add habit');
      }
    } catch (err) {
      setError('Network error adding habit');
    } finally {
      setAdding(false);
    }
  };

  const handleCompleteHabit = async (habitId: string) => {
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch(`/api/habits/${habitId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          localToday: todayStr,
          localYesterday: yesterdayStr
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setHabits((prev) => prev.map((h) => h.id === habitId ? updated : h));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to complete habit');
      }
    } catch (err) {
      alert('Network error completing habit');
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch(`/api/habits/${habitId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setHabits((prev) => prev.filter((h) => h.id !== habitId));
      } else {
        alert('Failed to delete habit');
      }
    } catch (err) {
      alert('Network error deleting habit');
    }
  };

  return (
    <div id="habits-section-container" className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-teal-950 font-sans">Daily Habits</h3>
          </div>
          <span className="text-[10px] text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full font-medium uppercase font-mono tracking-wider">
            Consistent Actions
          </span>
        </div>

        <form onSubmit={handleAddHabit} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add new daily habit..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={adding}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white p-2 rounded-lg transition shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {error && (
          <p className="text-xs text-rose-600 font-medium mb-3">{error}</p>
        )}

        {loading ? (
          <div className="text-center py-6 text-xs text-slate-400">Loading habits...</div>
        ) : habits.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-100 rounded-lg">
            No habits logged. Build consistency by adding your first!
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <AnimatePresence>
              {habits.map((habit) => {
                const isCompletedToday = habit.lastCompletedDate === todayStr;
                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => !isCompletedToday && handleCompleteHabit(habit.id)}
                        disabled={isCompletedToday}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                          isCompletedToday 
                            ? 'bg-teal-600 border-teal-600 text-white' 
                            : 'border-slate-300 hover:border-teal-500 bg-white cursor-pointer'
                        }`}
                      >
                        {isCompletedToday && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <span className={`text-sm font-medium min-w-0 truncate ${isCompletedToday ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <Flame className="w-3.5 h-3.5 fill-amber-500 stroke-none" />
                        <span>{habit.streak || 0}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete habit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
