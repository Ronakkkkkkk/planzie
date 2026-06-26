import { useEffect, useState } from 'react';

interface AgentStatus {
  intakeAgent: string;
  plannerAgent: string;
  recommendationEngine: string;
  planZAgent: string;
}

export function AgentStatusBar() {
  const [status, setStatus] = useState<AgentStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem('planzie_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/agent-status', { headers });
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        // fail silently for telemetry/status bar
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-white border-t border-slate-200 px-6 flex items-center justify-between text-[10px] text-slate-500 z-50 font-mono tracking-wider">
      <div className="flex gap-4 md:gap-8 flex-wrap items-center">
        <div className="flex items-center gap-1.5">
          <span>INTAKE_AGENT:</span>
          <span className={`font-semibold ${status?.intakeAgent === 'SUCCESS' ? 'text-emerald-600' : status?.intakeAgent && status.intakeAgent !== 'IDLE' ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`}>
            {status?.intakeAgent || 'IDLE'}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span>PLANNER_AGENT:</span>
          <span className={`font-semibold ${status?.plannerAgent === 'SUCCESS' ? 'text-emerald-600' : status?.plannerAgent && status.plannerAgent !== 'IDLE' ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`}>
            {status?.plannerAgent || 'LISTENING'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>RECO_ENGINE:</span>
          <span className={`font-semibold ${status?.recommendationEngine === 'SUCCESS' ? 'text-emerald-600' : status?.recommendationEngine && status.recommendationEngine !== 'IDLE' ? 'text-amber-500 animate-pulse' : 'text-teal-600'}`}>
            {status?.recommendationEngine || 'READY'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span>PLAN_Z_MONITOR:</span>
          <span className={`font-semibold ${status?.planZAgent === 'SUCCESS' ? 'text-emerald-600' : status?.planZAgent && status.planZAgent !== 'IDLE' ? 'text-rose-500 animate-pulse' : 'text-rose-500'}`}>
            {status?.planZAgent || 'SCANNING_ACTIVE'}
          </span>
        </div>
      </div>
      <div className="text-[10px] text-slate-400 hidden sm:block">
        LATENCY: 142ms
      </div>
    </div>
  );
}
