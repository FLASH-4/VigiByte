import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Shield, Camera, Users, AlertCircle, Activity, Plus, X, Server, Bell, Database, Globe, MapPin, Cpu, Fingerprint, Download, Eye, Link, LogOut } from 'lucide-react'
import * as faceapi from '@vladmandic/face-api'
import { loadModels, getAllFaceDescriptors, matchFace } from '../lib/faceRecognition'
import CameraFeed from './CameraFeed'
import AlertPanel from './AlertPanel'
import CriminalDB from './CriminalDB'
import { getStream, releaseStream } from '../lib/streamManager'
import { supabase } from '../lib/supabase'

export default function Dashboard({ user, onLogout }) {
  const [cameras, setCameras] = useState(() => {
    const saved = localStorage.getItem('security_cameras')
    return saved ? JSON.parse(saved) : [{ id: 'cam-1', name: 'ENTRY_CAM_01', location: 'Main Entrance', coordinates: '28.61, 77.20', source: 'webcam', type: 'webcam' }]
  })
  
  const [selectedCamera, setSelectedCamera] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [liveStats, setLiveStats] = useState([])
  const [globalAlerts, setGlobalAlerts] = useState([])
  const [activeTab, setActiveTab] = useState('alerts')
  const [criminals, setCriminals] = useState([])
  const [lastMatchOnNode, setLastMatchOnNode] = useState(null)
  const [localNodeStats, setLocalNodeStats] = useState({ totalDetections: 0, lastConf: 0 })
  const [viewingImageUrl, setViewingImageUrl] = useState(null)
  const [linkStatus, setLinkStatus] = useState('CONNECTING') // CONNECTING | ENCRYPTED | DISCONNECTED

  // Check Supabase connection health every 5 seconds
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('criminals').select('count', { count: 'exact', head: true })
        if (error) throw error
        setLinkStatus('ENCRYPTED')
      } catch (err) {
        console.error('Connection check failed:', err)
        setLinkStatus('DISCONNECTED')
      }
    }
    
    checkConnection() // Check immediately
    const interval = setInterval(checkConnection, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => { 
    loadModels(); 
    loadCriminals(); 
    localStorage.setItem('security_cameras', JSON.stringify(cameras)) 
  }, [cameras])

  async function loadCriminals() { 
    const { data } = await supabase.from('criminals').select('*'); 
    setCriminals(data || []) 
  }

  const handleGlobalUpdate = useCallback((match, camera, personCount, logMsg, confidence = 0) => {
    if (match) {
      const imgUrl = match.image_url || match.photo_url;
      setLastMatchOnNode({ ...match, image_url: imgUrl, cameraName: camera.name, confidence });
      setLocalNodeStats(prev => ({ totalDetections: prev.totalDetections + 1, lastConf: confidence }));

      setGlobalAlerts(prev => {
        const index = prev.findIndex(a => a.id === match.id)
        const now = Date.now()
        const det = { timestamp: now, camera: camera.name, location: camera.location, coordinates: camera.coordinates, confidence: confidence || match.confidence || 0 }
        if (index !== -1) {
          if (now - prev[index].detections[prev[index].detections.length - 1].timestamp < 10000) return prev
          const updated = [...prev]; updated[index] = { ...updated[index], lastSeen: now, detections: [...updated[index].detections, det] }; return updated
        }
        return [{ ...match, image_url: imgUrl, lastSeen: now, detections: [det] }, ...prev]
      })
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLiveStats(prev => {
      let load = Math.floor(Math.random() * 10) + 35; 
      if (personCount > 0) load += 15; 
      if (match) load = 94;
      const signal = confidence || (Math.floor(Math.random() * 8) + 5);
      const newData = [...prev, { time, load, signal }];
      return newData.slice(-15)
    })
  }, [])

  const handleAddCamera = (data) => { 
    setCameras(prev => [...prev, { id: `cam-${Date.now()}`, ...data, status: 'ONLINE' }]); 
    setShowAddModal(false); 
  }
  
  const handleDeleteCamera = (id, e) => { 
    e.stopPropagation(); 
    setCameras(prev => prev.filter(c => c.id !== id)); 
    if (selectedCamera?.id === id) setSelectedCamera(null); 
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-slate-300 font-sans p-6 tracking-tight">
      <header className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4"><Shield className="text-blue-500" size={26} /><div><h1 className="text-lg font-bold text-white uppercase tracking-tight leading-none">VigiByte</h1><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">Network Command Center v6.0</p></div></div>
        <div className="flex items-center gap-6">
          {user?.role === 'admin' && <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase transition-all shadow-lg active:scale-95 border border-blue-400/20">+ Add New Node</button>}
          <div className="flex items-center gap-4 pl-6 border-l border-white/10">
            <div className="text-right">
              <p className="text-[11px] font-bold text-white">{user?.email}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{user?.role === 'admin' ? '🔑 ADMIN' : user?.role === 'officer' ? '👮 OFFICER' : '👁️ VIEWER'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">{user?.email?.charAt(0).toUpperCase()}</div>
            <button onClick={onLogout} className="ml-2 p-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 rounded-lg transition-all border border-red-500/20 tooltip-trigger" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <KPICard label="Active Nodes" value={cameras.length} icon={<Server size={18}/>} color="blue" />
        <KPICard label="Identified Threats" value={globalAlerts.length} icon={<AlertCircle size={18}/>} color="red" />
        <KPICard label="Neural Load" value={`${liveStats.length > 0 ? liveStats[liveStats.length-1].load : 0}%`} icon={<Cpu size={18}/>} color="slate" />
        <KPICard label="Link Status" value={linkStatus} icon={<Globe size={18}/>} color={linkStatus === 'ENCRYPTED' ? 'green' : linkStatus === 'CONNECTING' ? 'slate' : 'red'} />
      </div>

      <section className="mb-10">
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-5 px-1 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Node Network Grid</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-5">
          {cameras.map(cam => (
            <div key={cam.id} className="relative group">
              <button onClick={() => { setSelectedCamera(cam); setLocalNodeStats({totalDetections: 0, lastConf: 0}); setLastMatchOnNode(null); }} className={`w-full aspect-video rounded-2xl border-2 transition-all relative overflow-hidden bg-slate-900 ${selectedCamera?.id === cam.id ? 'border-blue-500 shadow-2xl scale-[1.02]' : 'border-white/5 hover:border-blue-500/30'}`}>
                <GridNode camera={cam} criminals={criminals} onUpdate={handleGlobalUpdate} />
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 px-3 py-2 text-[9px] font-bold uppercase text-slate-300 border-t border-white/5 truncate">{cam.name}</div>
              </button>
              {user?.role === 'admin' && <button onClick={(e) => handleDeleteCamera(cam.id, e)} className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white border border-white/10 z-20 shadow-xl"><X size={10} /></button>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
            <ChartContainer title="Processing Load" icon={<Cpu size={14}/>}><ResponsiveContainer width="100%" height={180}><BarChart data={liveStats}><Bar dataKey="load" radius={[4, 4, 0, 0]} barSize={20}>{liveStats.map((e, i) => <Cell key={i} fill={e.load > 85 ? '#FF4040' : '#00AAFF'} />)}</Bar><Tooltip cursor={{fill: 'rgba(255,255,255,0.1)'}} contentStyle={{background: '#1a1f2e', border: '2px solid #00AAFF', borderRadius: '12px', fontSize: '11px', color: '#00AAFF', fontWeight: 'bold'}} /><XAxis dataKey="time" tick={{fontSize: 8, stroke: '#ffffff', fill: '#ffffff'}} /></BarChart></ResponsiveContainer></ChartContainer>
            <ChartContainer title="Neural Match Signal" icon={<Activity size={14}/>}><ResponsiveContainer width="100%" height={180}><AreaChart data={liveStats}><defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="signal" stroke="#3b82f6" strokeWidth={2.5} fill="url(#p)" /><Tooltip contentStyle={{background: '#0a0d14', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px'}} /></AreaChart></ResponsiveContainer></ChartContainer>
        </div>
        <div className="lg:col-span-8 bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
            <div className="flex bg-black/20 p-2 gap-2 border-b border-white/5"><TabBtn active={activeTab === 'alerts'} label="THREAT HISTORY" onClick={() => setActiveTab('alerts')} icon={<Bell size={14}/>} />{user?.role !== 'viewer' && <TabBtn active={activeTab === 'database'} label="DATABASE" onClick={() => setActiveTab('database')} icon={<Database size={14}/>} />}</div>
            <div className="p-8 h-[420px] overflow-y-auto custom-scrollbar">
                {activeTab === 'alerts' ? (
                  <AlertPanel alerts={globalAlerts} onViewImage={setViewingImageUrl} />
                ) : user?.role !== 'viewer' ? (
                  /* FIXED: SUPABASE PROP PASSED HERE */
                  <CriminalDB criminals={criminals} onRefresh={loadCriminals} supabase={supabase} userRole={user?.role} />
                ) : (
                  <div className="py-12 text-center opacity-50"><AlertCircle size={40} className="mx-auto mb-4 text-slate-600" /><p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">View-only Access - Database Management Disabled</p></div>
                )}
            </div>
        </div>
      </div>

      {/* POPUP INSPECTOR */}
      {selectedCamera && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/70 transition-all duration-300">
          <div className="bg-[#0c101f] w-full max-w-6xl rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex flex-col"><h2 className="text-sm font-bold text-white uppercase tracking-tight leading-none">Inspector Core: {selectedCamera.name}</h2><div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest"><MapPin size={10} className="text-blue-500" /> Site: {selectedCamera.location} | {selectedCamera.coordinates}</div></div>
                <button onClick={() => setSelectedCamera(null)} className="p-2.5 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-white/10"><X size={22}/></button>
            </div>
            <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2"><CameraFeed activeCamera={selectedCamera} onAlert={(match, log, conf) => handleGlobalUpdate(match, selectedCamera, 1, log, conf)} /></div>
                <div className="space-y-6">
                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex flex-col items-center">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 w-full text-left flex items-center gap-2"><Fingerprint size={14} className="text-blue-500" /> Biometric Signature</h4>
                        {lastMatchOnNode ? (
                            <div className="w-full space-y-8 animate-in fade-in duration-500">
                                <div className="flex items-center gap-6">
                                    <button onClick={() => setViewingImageUrl(lastMatchOnNode.image_url)} className="relative group/img overflow-hidden rounded-2xl border-2 border-red-500/30 shadow-2xl">
                                        <img src={lastMatchOnNode.image_url} className="w-20 h-20 object-cover" alt="Subject" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"><Eye size={18} /></div>
                                    </button>
                                    <div><h3 className="text-lg font-bold text-white uppercase tracking-tight">{lastMatchOnNode.name}</h3><p className="text-[9px] text-red-500 font-bold uppercase mt-1">{lastMatchOnNode.danger_level} DANGER</p></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl text-center"><p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Conf.</p><p className="text-lg font-bold text-emerald-500">{lastMatchOnNode.confidence}%</p></div>
                                    <div className="bg-white/5 p-4 rounded-2xl text-center"><p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Events</p><p className="text-lg font-bold text-blue-500">{localNodeStats.totalDetections}</p></div>
                                </div>
                            </div>
                        ) : ( <div className="py-12 text-center opacity-30"><Users size={40} className="mx-auto mb-4 text-slate-600" /><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Awaiting Target Identification...</p></div> )}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE VIEWER */}
      {viewingImageUrl && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-lg flex items-center justify-center p-8 animate-in fade-in" onClick={() => setViewingImageUrl(null)}>
            <div className="bg-[#0c0f16] border border-white/10 rounded-[2.5rem] p-8 relative shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setViewingImageUrl(null)} className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-lg border-2 border-white hover:bg-red-500 active:scale-95 transition-all z-20"><X size={16} /></button>
                <img src={viewingImageUrl} className="w-auto h-auto max-w-[80vw] max-h-[70vh] rounded-2xl object-contain border border-white/10 shadow-2xl" alt="Match Fullscreen" />
                <div className="pt-6 flex justify-center">
                    <a href={viewingImageUrl} download={`criminal_snap_${Date.now()}.jpg`} target="_blank" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg active:scale-95">
                        <Download size={14}/> Download Biometric Snapshot
                    </a>
                </div>
            </div>
        </div>
      )}

      {showAddModal && <AddNodeModal onAdd={handleAddCamera} onClose={() => setShowAddModal(false)} />}
    </div>
  )
}

function AddNodeModal({ onAdd, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    coordinates: '',
    type: 'webcam',
    source: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name || !formData.location) return
    onAdd(formData)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-black/70">
      <div className="bg-[#0c101f] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white uppercase tracking-tight">Add Surveillance Node</h3>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Node Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="ENTRY_CAM_01"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="Main Entrance"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Coordinates</label>
            <input
              type="text"
              value={formData.coordinates}
              onChange={(e) => setFormData({...formData, coordinates: e.target.value})}
              placeholder="28.61, 77.20"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Camera Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="webcam" className="bg-slate-900">📹 Webcam (Local Camera)</option>
              <option value="ip" className="bg-slate-900">🌐 IP Camera (RTSP/HTTP Stream)</option>
              <option value="image" className="bg-slate-900">🖼️ Static Image (Upload)</option>
            </select>
          </div>

          {formData.type === 'ip' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Stream URL</label>
              <input
                type="url"
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
                placeholder="rtsp://192.168.1.100:554/stream"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          )}

          {formData.type === 'image' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Image URL</label>
              <input
                type="url"
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
                placeholder="https://example.com/camera-image.jpg"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all"
            >
              Add Node
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 border border-white/5 text-slate-500 py-3 rounded-xl text-sm font-bold uppercase transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, color }) {
  const themes = { blue: 'border-blue-500/10 bg-blue-500/5 text-blue-500', red: 'border-red-500/10 bg-red-500/5 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.05)]', green: 'border-emerald-500/10 bg-emerald-500/5 text-emerald-500', slate: 'border-white/5 bg-white/[0.02] text-slate-300' }
  return ( <div className={`border rounded-[1.8rem] p-7 transition-all hover:translate-y-[-2px] ${themes[color]}`}><div className="flex items-center gap-3 mb-4 opacity-60 font-bold uppercase text-[10px] tracking-[0.1em]">{icon} {label}</div><p className="text-2xl font-bold tracking-tight">{value}</p></div> )
}

function TabBtn({ active, label, onClick, icon }) {
    return ( <button onClick={onClick} className={`flex-1 py-4 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl ${active ? 'bg-white/5 text-white shadow-sm' : 'text-slate-600 hover:text-slate-400'}`}>{icon} {label}</button> )
}

function ChartContainer({ title, children, icon }) {
    return ( <div className="bg-slate-900/30 border border-white/5 rounded-[2rem] p-7 shadow-sm"><div className="flex items-center gap-2 mb-8">{icon}<h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0">{title}</h4></div>{children}</div> )
}

function GridNode({ camera, criminals, onUpdate }) {
  const videoRef = useRef(null)
  const criminalsRef = useRef(criminals)

  // Keep criminalsRef fresh without re-triggering effect
  useEffect(() => {
    criminalsRef.current = criminals
  }, [criminals])

  useEffect(() => {
    let scanInterval = null
    let cancelled = false

    if (camera.type === 'webcam') {
      getStream(camera.id)
        .then(stream => {
          if (cancelled) return
          if (videoRef.current) videoRef.current.srcObject = stream

          scanInterval = setInterval(async () => {
            if (!videoRef.current || criminalsRef.current.length === 0) return
            try {
              const detections = await getAllFaceDescriptors(videoRef.current)
              const match = detections.length > 0
                ? matchFace(detections[0].descriptor, criminalsRef.current)
                : null
              onUpdate(match, camera, detections.length, null, match?.confidence)
            } catch (e) {}
          }, 6000)
        })
        .catch(err => console.error('GridNode stream error:', err))
    }

    return () => {
      cancelled = true
      clearInterval(scanInterval)
      // Do NOT release stream — CameraFeed will reuse it
    }
  }, [camera.id]) // ← ONLY camera.id, not full objects

  return (
    <div className="w-full h-full relative">
      {camera.type === 'webcam' ? (
        <video ref={videoRef} autoPlay muted playsInline
          className="w-full h-full object-cover" />
      ) : (
        <img src={camera.source} crossOrigin="anonymous"
          className="w-full h-full object-cover" alt="feed" />
      )}
    </div>
  )
}