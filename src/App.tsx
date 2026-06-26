import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Auth } from './components/Auth';
import { Logo } from './components/Logo';
import { TaskCard } from './components/TaskCard';
import { HabitsSection } from './components/HabitsSection';
import { FeedbackForm } from './components/FeedbackForm';
import { AgentStatusBar } from './components/AgentStatusBar';
import { Task } from './types';
import { 
  LogOut, 
  Sparkles, 
  Keyboard, 
  Play, 
  HelpCircle, 
  PlusCircle, 
  CheckCircle2, 
  Compass, 
  ListPlus,
  Loader2
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('planzie_token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('planzie_username'));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'direct'>('ai');

  // Recommendation state
  const [doThisNext, setDoThisNext] = useState<Task | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  // AI Intake Form
  const [intakeText, setIntakeText] = useState('');
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState('');

  // Direct Entry Form
  const [directTitle, setDirectTitle] = useState('');
  const [directDeadline, setDirectDeadline] = useState(''); // DD-MM-YYYY
  const [directEffort, setDirectEffort] = useState('1');
  const [directPriority, setDirectPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [directCategory, setDirectCategory] = useState('General');
  
  // Validation errors
  const [dateError, setDateError] = useState('');
  const [directError, setDirectError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-hyphen date formatter as user types DD-MM-YYYY
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, ''); // numbers only
    if (val.length > 8) val = val.slice(0, 8);

    let formatted = '';
    if (val.length > 4) {
      formatted = `${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4)}`;
    } else if (val.length > 2) {
      formatted = `${val.slice(0, 2)}-${val.slice(2)}`;
    } else {
      formatted = val;
    }

    setDirectDeadline(formatted);
    setDateError('');
  };

  // Convert extracted ISO date back to DD-MM-YYYY
  const isoToDDMMYYYY = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (err) {
      return '';
    }
  };

  // Check if session token is verified on initial load
  useEffect(() => {
    if (token) {
      fetchTasks();
    }
  }, [token]);

  const fetchTasks = async () => {
    if (!token) return;
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/tasks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        calculateRecommendations(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Error listing tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Dynamic Planner Recommendation Engine ("Plan My Day")
  const calculateRecommendations = (taskList: Task[]) => {
    setRecommendationLoading(true);
    const activeTasks = taskList.filter((t) => t.percentComplete < 100);
    
    if (activeTasks.length === 0) {
      setDoThisNext(null);
      setRecommendationLoading(false);
      return;
    }

    // Rank active tasks by: Urgency (deadline closeness) + Priority score
    const scoredTasks = activeTasks.map((task) => {
      const now = Date.now();
      const deadlineTime = new Date(task.deadline).getTime();
      const hoursRemaining = (deadlineTime - now) / (1000 * 60 * 60);

      const priorityWeight = task.priority === 'High' ? 300 : task.priority === 'Medium' ? 200 : 100;
      
      let urgencyScore = 0;
      if (hoursRemaining <= 0) {
        // Overdue tasks have enormous urgency
        urgencyScore = 1000 - hoursRemaining;
      } else {
        // Less time remaining = higher score
        urgencyScore = 200 / (hoursRemaining / 24);
      }

      return {
        task,
        score: priorityWeight + urgencyScore
      };
    });

    // Sort descending
    scoredTasks.sort((a, b) => b.score - a.score);
    setDoThisNext(scoredTasks[0].task);
    setRecommendationLoading(false);
  };

  const handlePlanMyDay = () => {
    fetchTasks();
  };

  const handleMarkDoThisNextComplete = async () => {
    if (!doThisNext) return;
    setRecommendationLoading(true);
    try {
      const res = await fetch(`/api/tasks/${doThisNext.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ percentComplete: 100 })
      });

      if (res.ok) {
        const updated = await res.json();
        handleTaskUpdate(doThisNext.id, updated);
      }
    } catch (err) {
      console.error('Failed to mark task complete:', err);
    } finally {
      setRecommendationLoading(false);
    }
  };

  const handleAuthSuccess = (newToken: string, newUsername: string) => {
    localStorage.setItem('planzie_token', newToken);
    localStorage.setItem('planzie_username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('planzie_token');
    localStorage.removeItem('planzie_username');
    setToken(null);
    setUsername(null);
    setTasks([]);
    setDoThisNext(null);
  };

  // Process AI free-text intake
  const handleAiIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeText.trim()) return;

    setIntakeLoading(true);
    setIntakeError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/tasks/ai-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: intakeText,
          clientTime: new Date().toISOString()
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Successfully extracted! Auto-populate direct entry form
        setDirectTitle(data.title || '');
        setDirectDeadline(isoToDDMMYYYY(data.deadline) || '');
        setDirectEffort(String(data.effort || '1'));
        setDirectPriority(data.priority || 'Medium');
        setDirectCategory(data.category || 'General');
        
        // Auto switch to Direct tab so user can review & adjust
        setActiveTab('direct');
        setSuccessMsg('AI successfully extracted details! Review and save below.');
      } else {
        setIntakeError(data.error || 'Planzie is facing high demand right now — try again in a moment.');
      }
    } catch (err) {
      setIntakeError('Planzie is facing high demand right now — try again in a moment.');
    } finally {
      setIntakeLoading(false);
    }
  };

  // Direct Entry validation and saving
  const handleDirectSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');
    setDirectError('');
    setSuccessMsg('');

    if (!directTitle.trim() || !directDeadline || !directEffort) {
      setDirectError('All fields are required.');
      return;
    }

    // Strict validation of DD-MM-YYYY
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(directDeadline)) {
      setDateError('Enter a valid date.');
      return;
    }

    const parts = directDeadline.split('-');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    const year = parseInt(parts[2], 10);

    // Month days check
    const parsedDate = new Date(year, month, day);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month ||
      parsedDate.getDate() !== day
    ) {
      setDateError('Enter a valid date.');
      return;
    }

    // Check if past date relative to local date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDate = new Date(year, month, day);
    inputDate.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      setDateError('Enter a valid date.');
      return;
    }

    // Correct date! Convert to ISO for backend storage
    const isoString = new Date(year, month, day, 12, 0, 0).toISOString();

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: directTitle.trim(),
          deadline: isoString,
          effort: Number(directEffort),
          priority: directPriority,
          category: directCategory
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => [data, ...prev]);
        calculateRecommendations([data, ...tasks]);
        
        // Clear Direct Entry fields
        setDirectTitle('');
        setDirectDeadline('');
        setDirectEffort('1');
        setDirectPriority('Medium');
        setDirectCategory('General');
        setIntakeText('');
        
        setSuccessMsg('Task added successfully!');
      } else {
        setDirectError(data.error || 'Failed to save task.');
      }
    } catch (err) {
      setDirectError('Network error saving task.');
    }
  };

  // Task events
  const handleTaskUpdate = (id: string, updatedTask: Partial<Task>) => {
    const updatedTasks = tasks.map((t) => t.id === id ? { ...t, ...updatedTask } as Task : t);
    setTasks(updatedTasks);
    calculateRecommendations(updatedTasks);
  };

  const handleTaskDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const remaining = tasks.filter((t) => t.id !== id);
        setTasks(remaining);
        calculateRecommendations(remaining);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f2f6f5] pb-20 font-sans text-slate-800 antialiased">
      {/* Top Header */}
      <header className="sticky top-0 bg-white border-b border-teal-100/50 px-6 py-4 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo className="w-8 h-8" textClassName="text-xl font-bold" />
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              USER: <span className="text-teal-900 font-bold uppercase">{username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Recommendation Engine: Prominent "Do This Next" Banner */}
        {doThisNext && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="banner-glow bg-white border border-rose-100 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shrink-0 transition-all duration-300"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
              <div className="bg-rose-50 px-3 py-1.5 rounded text-rose-600 text-xs font-bold uppercase tracking-widest shrink-0">
                Do This Next
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight font-sans">
                  {doThisNext.title}
                </h2>
                <p className="text-sm text-slate-500 font-sans">
                  Deadline: <span className="font-semibold text-slate-700">{(() => {
                    try {
                      const d = new Date(doThisNext.deadline);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}-${month}-${year}`;
                    } catch {
                      return doThisNext.deadline;
                    }
                  })()}</span> | Est. Effort: <span className="font-semibold text-slate-700">{doThisNext.effort}h</span> | Priority: <span className="text-rose-600 font-bold">{doThisNext.priority}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
              <button
                onClick={handleMarkDoThisNextComplete}
                disabled={recommendationLoading}
                className="bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-teal-700 transition duration-150 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {recommendationLoading ? 'Updating...' : 'Mark Complete'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Bento Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Side: Planner Entry (Direct vs AI) + Habits + Feedback */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Task Entry Card */}
            <div id="task-entry-card" className="bg-white rounded-xl border border-teal-100 shadow-sm overflow-hidden flex flex-col justify-between">
              
              {/* Card Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50">
                <button
                  onClick={() => {
                    setActiveTab('ai');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                    activeTab === 'ai' 
                      ? 'bg-white text-teal-700 border-b-teal-600' 
                      : 'text-slate-500 border-b-transparent hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>AI Intake Agent</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('direct');
                    setSuccessMsg('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                    activeTab === 'direct' 
                      ? 'bg-white text-teal-700 border-b-teal-600' 
                      : 'text-slate-500 border-b-transparent hover:text-slate-800'
                  }`}
                >
                  <Keyboard className="w-4 h-4 text-teal-600" />
                  <span>Direct Entry</span>
                </button>
              </div>

              {/* Form Areas */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  {successMsg && (
                    <div className="bg-teal-50 border border-teal-100 text-teal-800 text-xs rounded-lg p-3 mb-4 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {activeTab === 'ai' ? (
                    <form onSubmit={handleAiIntakeSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Free-text task description</label>
                        <textarea
                          placeholder="e.g. Finish chemistry presentation by tomorrow evening, takes about 3 hours. Category is school, priority is high."
                          value={intakeText}
                          onChange={(e) => setIntakeText(e.target.value)}
                          className="w-full h-32 p-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white resize-none"
                          required
                        />
                      </div>

                      {intakeError && (
                        <p className="text-xs text-rose-600 font-medium">{intakeError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={intakeLoading || !intakeText.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider py-3 px-4 rounded-lg shadow-sm transition"
                      >
                        {intakeLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>PROCESSING THROUGH AI...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 fill-white" />
                            <span>PROCESS WITH AI INTAKE</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleDirectSave} className="space-y-4">
                      {directError && (
                        <p className="text-xs text-rose-600 font-medium">{directError}</p>
                      )}

                      <div className="space-y-1">
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Task Title</label>
                        <input
                          type="text"
                          placeholder="What needs to be done?"
                          value={directTitle}
                          onChange={(e) => setDirectTitle(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Deadline (DD-MM-YYYY)</label>
                          <input
                            type="text"
                            placeholder="DD-MM-YYYY"
                            value={directDeadline}
                            onChange={handleDateChange}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                            required
                          />
                          {dateError && (
                            <p className="text-xs text-rose-600 font-medium">{dateError}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Effort (Hours)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            placeholder="Hours"
                            value={directEffort}
                            onChange={(e) => setDirectEffort(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Priority</label>
                          <select
                            value={directPriority}
                            onChange={(e) => setDirectPriority(e.target.value as any)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Category</label>
                          <input
                            type="text"
                            placeholder="Work, Health, etc."
                            value={directCategory}
                            onChange={(e) => setDirectCategory(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 focus:bg-white transition"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold uppercase tracking-wider py-3 px-4 rounded-lg shadow-sm transition mt-2"
                      >
                        Save Task
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Daily Habits tracker */}
            <HabitsSection />

            {/* Feedback Form */}
            <FeedbackForm />
          </div>

          {/* Right Side: Active Task List & Timelines */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-xl border border-teal-100 shadow-sm h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <ListPlus className="w-5 h-5 text-teal-600" />
                    <h3 className="text-lg font-semibold text-teal-950 font-sans">Active Task Matrix</h3>
                  </div>
                  <button
                    onClick={handlePlanMyDay}
                    className="text-xs text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100/50 font-bold tracking-wide"
                  >
                    Refresh List
                  </button>
                </div>

                {loadingTasks ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                    <span className="text-xs font-mono">Syncing active workloads...</span>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-24 border border-dashed border-slate-100 rounded-xl">
                    <CheckCircle2 className="w-10 h-10 text-teal-500/50 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-500 font-sans">Your slate is completely clean!</p>
                    <p className="text-xs text-slate-400 mt-1">Add tasks via the AI Intake Agent or Direct Entry.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                    <AnimatePresence>
                      {tasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="h-full"
                        >
                          <TaskCard
                            task={task}
                            onUpdate={handleTaskUpdate}
                            onDelete={handleTaskDelete}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Plan My Day footer button */}
              {tasks.length > 0 && (
                <button
                  onClick={handlePlanMyDay}
                  disabled={recommendationLoading}
                  className="w-full mt-6 py-2.5 border border-dashed border-teal-300 hover:bg-teal-50/50 text-teal-600 hover:text-teal-700 text-xs font-bold rounded-lg transition duration-150 cursor-pointer disabled:opacity-50"
                >
                  {recommendationLoading ? 'Recalculating...' : 'Plan My Day (Re-run Recommender)'}
                </button>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Persistent Monospaced Status Indicator Bar */}
      <AgentStatusBar />
    </div>
  );
}
