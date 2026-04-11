import { useState } from 'react'
import { MapPin, Clock, ShieldAlert, Camera, Activity, X, ChevronRight, Eye } from 'lucide-react'

/**
 * AlertPanel Component
 * Purpose: Displays real-time security breaches and detailed subject history.
 * This component handles the list of 'Neural Matches' and a detailed modal for individual subject tracking.
 */
export default function AlertPanel({ alerts, onViewImage }) {
  const [selected, setSelected] = useState(null); // State to track which alert is being viewed in detail

  // Handle empty state: Shown when no threats are currently detected by the AI nodes
  if (!alerts || alerts.length === 0) return (
    <div className="text-center py-20 text-slate-600">
      <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
      <p className="font-bold uppercase tracking-widest text-xs">No Security Breaches Detected</p>
      <p className="text-[10px] uppercase opacity-50 mt-1 tracking-tighter">Neural nodes monitoring perimeter...</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* SUBJECT HISTORY MODAL 
          Triggered when a user clicks on an alert card to see the full detection history.
      */}
      {selected && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#0f121a] border border-white/10 rounded-[2rem] w-full max-w-lg space-y-6 p-8 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Subject Profile Header */}
            <div className="flex items-center gap-5">
              <button onClick={() => onViewImage(selected.image_url || selected.photo_url)} className="relative group/modal overflow-hidden rounded-2xl border-2 border-red-500/30">
                <img src={selected.image_url || selected.photo_url} className="w-20 h-20 object-cover" alt="Subject" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/modal:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye size={16} />
                </div>
              </button>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                   <h3 className="font-bold text-white text-xl tracking-tight uppercase">{selected.name}</h3>
                   <button onClick={() => setSelected(null)} className="p-1 hover:bg-white/5 rounded-lg transition-all">
                     <X size={18} className="text-slate-500" />
                   </button>
                </div>
                <div className="mt-2 inline-block px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-widest">
                    {selected.danger_level} DANGER {/* Visual indicator of the subject's threat level */}
                </div>
              </div>
            </div>

            {/* Neural Analytics Grid: Displays aggregated data for the subject */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-red-500 tracking-tighter">{selected.detections?.length || 0}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Detections</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-emerald-500 tracking-tighter">
                   {/* Logic to calculate average match confidence across all detections */}
                   {Math.round(selected.detections?.reduce((a, d) => a + (d.confidence || 0), 0) / (selected.detections?.length || 1))}%
                </p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Avg Conf.</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-blue-500 tracking-tighter">
                  {/* Logic to count unique camera nodes that detected the subject */}
                  {new Set(selected.detections?.map(d => d.camera)).size}
                </p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Nodes</p>
              </div>
            </div>

            {/* Timeline of Detections: Scrollable list of every time the AI identified this subject */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {[...selected.detections].reverse().map((d, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{d.camera}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <MapPin size={8} className="text-blue-500" /> {d.location} | {d.coordinates}
                      </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-white font-mono opacity-80">{new Date(d.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[9px] text-emerald-500 font-bold">{Math.round(d.confidence || 0)}% Match</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ALERT FEED: Main list showing the latest tracked matches */}
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          {alerts.length} Neural Matches Tracked
      </p>

      <div className="space-y-3">
        {alerts.map((alert) => {
          // Extract data from the most recent detection event
          const lastDet = alert.detections[alert.detections.length - 1]; 
          const imgUrl = alert.image_url || alert.photo_url;
          
          return (
            <div key={alert.id} className="bg-white/[0.02] border border-white/5 hover:border-red-500/30 rounded-2xl p-5 flex items-center gap-6 cursor-pointer transition-all duration-300 group" onClick={() => setSelected(alert)}>
              
              {/* Profile Image with Hover Preview Action */}
              <button onClick={(e) => { e.stopPropagation(); onViewImage(imgUrl); }} className="relative group/img flex-shrink-0">
                <img src={imgUrl} className="w-14 h-14 rounded-xl object-cover border border-white/10" alt="match" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                  <Eye size={16} />
                </div>
              </button>

              {/* Identification & Location Details */}
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h4 className="text-white font-bold text-sm uppercase tracking-tight group-hover:text-red-400 transition-colors">{alert.name}</h4>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${alert.danger_level === 'HIGH' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                    {alert.danger_level} DANGER
                  </span>
                </div>
                <div className="flex items-center gap-5 mt-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    <MapPin size={10} className="text-blue-500" /> {lastDet?.location}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 uppercase">
                    <Clock size={10} /> {new Date(alert.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Match Confidence Score: Real-time accuracy from the AI engine */}
              <div className="text-right pl-4 border-l border-white/5">
                <p className="text-emerald-500 font-bold text-base leading-none">{Math.round(lastDet?.confidence || 0)}%</p>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Match</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}