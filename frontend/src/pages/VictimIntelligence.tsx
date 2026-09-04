import React, { useState, useEffect } from 'react';
import { Victim } from '../types';
import { api } from '../services/api';
import { HeartPulse, AlertTriangle, Send, RefreshCw, CheckCircle2, Users, ShieldAlert } from 'lucide-react';

interface VictimIntelligenceProps {
  onRefresh: () => void;
}

export const VictimIntelligence: React.FC<VictimIntelligenceProps> = ({ onRefresh }) => {
  const [victims, setVictims] = useState<Victim[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [msg, setMsg] = useState<string>('');

  const fetchVictims = async () => {
    try {
      setLoading(true);
      const data = await api.listVictims();
      setVictims(data.sort((a, b) => b.priority_score - a.priority_score));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVictims();
  }, []);

  const handleReprioritize = async () => {
    try {
      setActionLoading('recalc');
      const updated = await api.reprioritizeVictims();
      setVictims(updated);
      setMsg('Victims successfully re-prioritized across all criteria.');
      onRefresh();
    } catch (e: any) {
      setMsg('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleDispatch = async (vicId: string) => {
    try {
      setActionLoading(vicId);
      const res = await api.dispatchDrone('AUTO', vicId);
      setMsg(res.message || `Dispatched mission for ${vicId}`);
      fetchVictims();
      onRefresh();
    } catch (e: any) {
      setMsg('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0b121e] border border-cyan-900/40 p-4 rounded-xl shadow-lg">
        <div>
          <h2 className="text-base font-bold font-mono text-slate-100 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-red-500 animate-pulse" /> Explainable Victim Prioritization
          </h2>
          <p className="text-xs text-slate-400">
            Multi-criteria prioritization engine: medical severity (35%), survival urgency (25%), hazard exposure (20%), accessibility (10%), confidence (10%).
          </p>
        </div>
        <button
          onClick={handleReprioritize}
          disabled={actionLoading !== ''}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-mono font-bold rounded shadow transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${actionLoading === 'recalc' ? 'animate-spin' : ''}`} /> Recalculate Priorities
        </button>
      </div>

      {msg && (
        <div className="p-2.5 bg-cyan-950/80 border border-cyan-700 text-cyan-300 rounded-lg text-xs font-mono">
          {msg}
        </div>
      )}

      {/* Victims Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {victims.map((vic) => (
          <div
            key={vic.id}
            className={`bg-[#0b121e] border p-4 rounded-xl shadow-lg flex flex-col justify-between transition ${
              vic.priority_class === 'CRITICAL'
                ? 'border-red-700/80 bg-red-950/10'
                : vic.priority_class === 'HIGH'
                ? 'border-amber-700/60 bg-amber-950/10'
                : 'border-cyan-900/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-slate-100">{vic.id}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({vic.location.x.toFixed(0)}, {vic.location.z.toFixed(0)})
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                    vic.priority_class === 'CRITICAL'
                      ? 'bg-red-600 text-white animate-pulse'
                      : vic.priority_class === 'HIGH'
                      ? 'bg-amber-600 text-white'
                      : 'bg-cyan-900 text-cyan-200'
                  }`}
                >
                  {vic.priority_class} ({vic.priority_score.toFixed(3)})
                </span>
              </div>

              <div className="text-xs font-bold text-slate-200 mb-2">{vic.name}</div>

              {/* Contributing Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-lg text-[11px] font-mono mb-3">
                <div>
                  <span className="text-slate-500 block text-[10px]">TRAUMA</span>
                  <span className="text-red-400 font-bold">{(vic.medical_severity * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">URGENCY</span>
                  <span className="text-amber-400 font-bold">{(vic.estimated_survival_urgency * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">EXPOSURE</span>
                  <span className="text-orange-400 font-bold">{(vic.hazard_exposure * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">PEOPLE</span>
                  <span className="text-slate-200 font-bold">{vic.people_count}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ACCESS</span>
                  <span className="text-slate-300 font-bold">{(vic.accessibility_factor * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CONFIDENCE</span>
                  <span className="text-emerald-400 font-bold">{(vic.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Explainable Decision Trace */}
              {vic.breakdown?.reasons && vic.breakdown.reasons.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                    Explainable AI Factors:
                  </div>
                  <div className="space-y-1">
                    {vic.breakdown.reasons.map((reason, i) => (
                      <div key={i} className="text-[11px] font-mono text-slate-300 flex items-start gap-1.5">
                        <span className="text-cyan-400">▸</span> {reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mission Dispatch Action */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Status: <strong className="text-slate-200">{vic.status}</strong>
                {vic.assigned_drone_id && ` (${vic.assigned_drone_id})`}
              </span>
              {vic.status !== 'ASSISTED' && !vic.assigned_drone_id ? (
                <button
                  onClick={() => handleDispatch(vic.id)}
                  disabled={actionLoading !== ''}
                  className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold rounded shadow transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Drone
                </button>
              ) : (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Serviced
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
