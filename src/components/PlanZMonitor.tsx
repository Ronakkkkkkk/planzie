import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Activity, ChevronDown, ChevronUp, ShieldCheck, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { Task } from '../types';

interface PlanZMonitorProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

export function PlanZMonitor({ tasks, onUpdateTask }: PlanZMonitorProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeTasks = tasks.filter(t => t.percentComplete < 100);
  const planZTasks = activeTasks.filter(t => t.escalationLevel === 'autonomous_action');
  const urgentTasks = activeTasks.filter(t => t.escalationLevel === 'urgent_push');
  const reminderTasks = activeTasks.filter(t => t.escalationLevel === 'gentle_reminder');
  const onTrackTasks = activeTasks.filter(t => t.escalationLevel === 'on_track');

  // Determine overall Plan Z Monitor System Status
  let statusText = 'Scanning - Timeline Secure';
  let statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
  let pulseColor = 'bg-emerald-500';
  let systemStatus: 'normal' | 'warning' | 'critical' = 'normal';

  if (planZTasks.length > 0) {
    statusText = `${planZTasks.length} Critical Escalation${planZTasks.length > 1 ? 's' : ''} Active`;
    statusColor = 'text-rose-600 bg-rose-50 border-rose-100';
    pulseColor = 'bg-rose-500';
    systemStatus = 'critical';
  } else if (urgentTasks.length > 0) {
    statusText = `${urgentTasks.length} High-Risk Task${urgentTasks.length > 1 ? 's' : ''} on Watch`;
    statusColor = 'text-amber-600 bg-amber-50 border-amber-100';
    pulseColor = 'bg-amber-500';
    systemStatus = 'warning';
  }

  const toggleExpand = (id: string) => {
    setExpandedTaskId(expandedTaskId === id ? null : id);
  };

  const isDraftError = (d?: string) => {
    if (!d) return true;
    const lower = d.toLowerCase();
    return lower.includes('facing high demand') || lower.includes('could not be generated') || lower.trim() === '';
  };

  const handleUpdate = async (taskId: string, payload: Partial<Task>) => {
    setIsUpdatingId(taskId);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem('planzie_token');
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdateTask(taskId, updated);
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || 'Failed to update task.');
      }
    } catch (err) {
      console.error('Failed to update task:', err);
      setErrorMessage('Network connection error. Try again.');
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <div id="plan-z-monitor-card" className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-semibold text-teal-950 font-sans">Plan Z Escalate Monitor</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Pipeline Active</span>
        </div>

        {/* Overall Monitor Status Banner */}
        <div className={`flex items-center justify-between p-3.5 rounded-lg border ${statusColor} mb-5`}>
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${pulseColor}`}></span>
            </div>
            <div className="space-y-0.5">
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans">System Monitor</span>
              <span className="text-sm font-bold tracking-tight font-sans">{statusText}</span>
            </div>
          </div>
          {systemStatus === 'normal' ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-bounce" />
          )}
        </div>

        {/* Breakdown Overview */}
        <div className="grid grid-cols-4 gap-2 mb-5 text-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="border-r border-slate-200 last:border-0 pr-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">On Track</span>
            <span className="text-lg font-bold text-slate-700 font-sans">{onTrackTasks.length}</span>
          </div>
          <div className="border-r border-slate-200 last:border-0 px-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Behind</span>
            <span className="text-lg font-bold text-slate-700 font-sans">{reminderTasks.length}</span>
          </div>
          <div className="border-r border-slate-200 last:border-0 px-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Urgent</span>
            <span className="text-lg font-bold text-amber-600 font-sans">{urgentTasks.length}</span>
          </div>
          <div className="last:border-0 pl-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Z</span>
            <span className="text-lg font-bold text-rose-600 font-sans">{planZTasks.length}</span>
          </div>
        </div>

        {/* Escalated Tasks List */}
        <div className="space-y-3">
          {planZTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-slate-100 rounded-lg bg-slate-50/50 p-4">
              <p className="text-xs font-medium text-slate-500 leading-relaxed font-sans">
                All tasks are currently within safety margins. Plan Z escalation pipeline is ready to deploy should a timeline fail.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Escalated Tasks Requiring Approval</span>
              {planZTasks.map((task) => {
                const isExpanded = expandedTaskId === task.id;
                const isTaskUpdating = isUpdatingId === task.id;
                const hasError = isDraftError(task.draftRequestingMoreTime) || isDraftError(task.draftMinimumViablePlan);

                return (
                  <div key={task.id} className="border border-rose-100 rounded-lg overflow-hidden bg-rose-50/25">
                    <button
                      onClick={() => toggleExpand(task.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-rose-50/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Zap className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
                        <span className="text-xs font-bold text-slate-800 truncate font-sans">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.draftApproved ? (
                          <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full uppercase">Approved</span>
                        ) : hasError ? (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase">Draft Error</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full uppercase animate-pulse">Pending Approval</span>
                        )}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="border-t border-rose-100 bg-white"
                        >
                          <div className="p-3.5 space-y-3 text-xs leading-normal">
                            {errorMessage && (
                              <div className="flex items-start gap-2 p-2.5 rounded bg-rose-50 border border-rose-100 text-rose-700 text-[11px] leading-snug">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <span className="font-sans font-medium">{errorMessage}</span>
                              </div>
                            )}

                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Backup Mitigation Plan (MVP)</span>
                              <div className="bg-slate-50 border border-slate-100 p-3 rounded text-slate-700 italic font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {task.draftMinimumViablePlan || 'Generating mitigation steps...'}
                              </div>
                            </div>

                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Extension Draft Request</span>
                              <div className="bg-slate-50 border border-slate-100 p-3 rounded text-slate-700 italic font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {task.draftRequestingMoreTime || 'Generating communication draft...'}
                              </div>
                            </div>

                            {/* Regenerate Action / Error Panel */}
                            {hasError ? (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                                <div className="flex items-start gap-2 text-amber-800 text-[11px] leading-relaxed">
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <p className="font-sans">
                                    Mitigation drafts failed to generate due to rate limiting or high AI service load. Try requesting a fresh draft generation.
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleUpdate(task.id, { forceRegeneratePlanZ: true })}
                                  disabled={isTaskUpdating}
                                  className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold py-2 rounded text-[11px] tracking-wide uppercase shadow-sm cursor-pointer transition"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isTaskUpdating ? 'animate-spin' : ''}`} />
                                  {isTaskUpdating ? 'Generating...' : 'Retry Draft Generation'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                {!task.draftApproved && (
                                  <button
                                    onClick={() => handleUpdate(task.id, { draftApproved: true })}
                                    disabled={isTaskUpdating}
                                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-lg text-[11px] tracking-wide uppercase shadow-sm cursor-pointer transition"
                                  >
                                    Approve Plan Z Mitigation
                                  </button>
                                )}

                                <button
                                  onClick={() => handleUpdate(task.id, { forceRegeneratePlanZ: true })}
                                  disabled={isTaskUpdating}
                                  title="Force regeneration of mitigation drafts"
                                  className="px-3.5 border border-slate-200 hover:border-teal-500 text-slate-500 hover:text-teal-600 disabled:bg-slate-100 rounded-lg transition cursor-pointer flex items-center justify-center"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isTaskUpdating ? 'animate-spin' : ''}`} />
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
