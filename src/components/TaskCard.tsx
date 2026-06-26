import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, AlertTriangle, CheckCircle, Trash2, ShieldAlert, Check, HelpCircle } from 'lucide-react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onUpdate, onDelete }: TaskCardProps) {
  const [sliderVal, setSliderVal] = useState(task.percentComplete);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showZDrafts, setShowZDrafts] = useState(true);

  // Determine colors based on status & escalation level
  let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
  let borderAccent = 'border-l-4 border-l-emerald-500';
  let cardBg = 'bg-white';
  let statusText = 'On Track';

  if (task.percentComplete === 100) {
    badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
    borderAccent = 'border-l-4 border-l-slate-400';
    cardBg = 'bg-slate-50 opacity-90';
    statusText = 'Completed';
  } else if (task.escalationLevel === 'autonomous_action') {
    badgeColor = 'bg-rose-50 text-rose-800 border-rose-100';
    borderAccent = 'border-l-4 border-l-rose-500';
    statusText = 'Plan Z Active';
  } else if (task.escalationLevel === 'urgent_push') {
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-100';
    borderAccent = 'border-l-4 border-l-amber-500';
    statusText = 'Urgent Push';
  } else if (task.escalationLevel === 'gentle_reminder') {
    badgeColor = 'bg-amber-50/50 text-amber-700 border-amber-100/50';
    borderAccent = 'border-l-4 border-l-amber-400/80';
    statusText = 'Behind Schedule';
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSliderVal(val);
  };

  const handleSliderRelease = async () => {
    if (sliderVal === task.percentComplete) return;
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ percentComplete: sliderVal })
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdate(task.id, updated);
      }
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleComplete = async () => {
    const nextVal = task.percentComplete === 100 ? 0 : 100;
    setSliderVal(nextVal);
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ percentComplete: nextVal })
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdate(task.id, updated);
      }
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveDraft = async () => {
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ draftApproved: true })
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdate(task.id, updated);
      }
    } catch (err) {
      console.error('Failed to approve draft:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Priority color
  const priorityColor = 
    task.priority === 'High' 
      ? 'bg-rose-50 text-rose-700 border-rose-100' 
      : task.priority === 'Medium' 
        ? 'bg-amber-50 text-amber-700 border-amber-100' 
        : 'bg-slate-100 text-slate-700 border-slate-200';

  // Format deadline for reading
  const formattedDate = () => {
    try {
      const date = new Date(task.deadline);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (err) {
      return task.deadline;
    }
  };

  return (
    <div className={`p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all duration-300 ${cardBg} ${borderAccent} h-full`}>
      <div className="space-y-3">
        {/* Header Badges */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
            {task.category}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {statusText}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
              {task.priority} Priority
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h4 className={`text-base font-semibold leading-tight font-sans ${task.percentComplete === 100 ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </h4>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formattedDate()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{task.effort}h effort</span>
          </div>
        </div>

        {/* Progress Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-mono text-slate-500">
            <span>Progress: {sliderVal}%</span>
            <span>{sliderVal === 100 ? 'Done' : 'Active'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderVal}
              onChange={handleSliderChange}
              onMouseUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              className="w-full accent-teal-600 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
            <button
              onClick={toggleComplete}
              className={`p-1 rounded border transition ${
                task.percentComplete === 100 
                  ? 'bg-teal-600 border-teal-600 text-white' 
                  : 'bg-white border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-500'
              }`}
              title={task.percentComplete === 100 ? 'Mark Incomplete' : 'Mark Completed'}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>

      {/* Plan Z Mitigations Drawer */}
      {task.percentComplete < 100 && task.escalationLevel === 'autonomous_action' && (
        <div className="mt-4 pt-3 border-t border-rose-100 bg-rose-50/50 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-xs">
              <ShieldAlert className="w-4 h-4 animate-bounce" />
              <span>PLAN Z ACTIVE (Auto-Escalated)</span>
            </div>
            <button
              onClick={() => setShowZDrafts(!showZDrafts)}
              className="text-[10px] text-teal-800 hover:text-teal-900 font-bold uppercase tracking-wider"
            >
              {showZDrafts ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {showZDrafts && (
            <div className="space-y-2 text-xs">
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Mitigation 1: Extension Draft</span>
                <p className="bg-white border border-rose-100 p-2 rounded text-slate-700 italic leading-relaxed whitespace-pre-line font-mono text-[11px] max-h-24 overflow-y-auto">
                  {task.draftRequestingMoreTime || 'Drafting...'}
                </p>
              </div>

              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Mitigation 2: Minimum Viable Version Plan</span>
                <p className="bg-white border border-rose-100 p-2 rounded text-slate-700 italic leading-relaxed whitespace-pre-line font-mono text-[11px] max-h-24 overflow-y-auto">
                  {task.draftMinimumViablePlan || 'Drafting...'}
                </p>
              </div>

              {task.draftApproved ? (
                <div className="flex items-center justify-center gap-1 bg-teal-50 border border-teal-100 text-teal-800 py-1.5 rounded-md font-medium text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                  <span>Draft Approved</span>
                </div>
              ) : (
                <button
                  onClick={handleApproveDraft}
                  disabled={isUpdating || !task.draftRequestingMoreTime}
                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs py-1.5 rounded font-semibold tracking-wide transition shadow-sm"
                >
                  Approve Plan Z Mitigation
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer delete */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
        <button
          onClick={() => onDelete(task.id)}
          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition"
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
