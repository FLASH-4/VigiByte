import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Shield, AlertCircle, Activity, X, Server, Bell, Database, Globe, MapPin, Cpu, Download, Eye, LogOut } from 'lucide-react'
import { loadModels, detectAllCriminals, checkBackend } from '../lib/faceRecognition'
import CameraFeed from './CameraFeed'
import AlertPanel from './AlertPanel'
import CriminalDB from './CriminalDB'
import { getStream, releaseStream } from '../lib/streamManager'
import { supabase, createScopedClient } from '../lib/supabase'

/**
 * VIGIBYTE DASHBOARD
 * Purpose: Central Command Center for managing surveillance nodes and real-time AI analytics.
 * This component orchestrates the state for the entire application, including security alerts,
 * database records, and system health monitoring.
 */
export default function Dashboard({ user, onLogout }) {
  const scopedSupabase = createScopedClient(user?.id)

  // --- STATE MANAGEMENT ---

  // Camera Nodes: Persisted in Supabase per-user
  const [cameras, setCameras] = useState([])
  
  const [selectedCamera, setSelectedCamera] = useState(null) // Currently focused camera in 'Inspector' mode

  // Effect to prevent background scrolling when the Inspector Modal is active
  useEffect(() => { 
    document.body.style.overflow = selectedCamera ? 'hidden' : '';
  }, [selectedCamera])
  
  const [showAddModal, setShowAddModal] = useState(false) // UI state for adding new cameras
  const [liveStats, setLiveStats] = useState([])         // Data for Recharts analytics
  const [globalAlerts, setGlobalAlerts] = useState([])   // Master list of all security breaches
  const [activeTab, setActiveTab] = useState('alerts')   // UI navigation: Alerts vs Database
  const [criminals, setCriminals] = useState([])         // Records from Supabase
  const [lastMatchOnNode, setLastMatchOnNode] = useState(null)
  const [localNodeStats, setLocalNodeStats] = useState({ totalDetections: 0, lastConf: 0 })
  const [viewingImageUrl, setViewingImageUrl] = useState(null) // Full-screen image viewer state
  const [linkStatus, setLinkStatus] = useState('CONNECTING') // CONNECTING | ENCRYPTED | DISCONNECTED
  const [detectedCriminals, setDetectedCriminals] = useState([]) // Live subjects in the current active feed

  /**
   * SYSTEM HEALTH CHECK
   * Periodically verifies the connection between the frontend, Supabase, and the Python AI Backend.
   */
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Step 1: Verify Supabase database accessibility
        const { error: dbError } = await supabase.from('criminals').select('count', { count: 'exact', head: true });
        
        // Step 2: Ping the Python FastAPI Backend (The AI Engine)
        const isAiOnline = await checkBackend(); 

        // Update Link Status: Both must be online to show 'ENCRYPTED'
        if (dbError || !isAiOnline) {
          setLinkStatus('DISCONNECTED');
        } else {
          setLinkStatus('ENCRYPTED'); 
        }
      } catch (err) {
        setLinkStatus('DISCONNECTED');
      }
    }
    
    checkConnection(); // Immediate check on mount
    const interval = setInterval(checkConnection, 5000); // Pulse every 5 seconds
    return () => clearInterval(interval);
  }, [])

  // Initial Load: Pre-load AI models and sync camera registry + criminal registry
  useEffect(() => {
    loadModels();
    loadCameras();
    loadCriminals();
  }, [user?.id])

  // Fetches suspect records from the cloud database
  async function loadCriminals() {
    const { data } = await scopedSupabase.from('criminals').select('*').eq('user_id', user?.id);
    setCriminals(data || [])
  }

  // Fetches camera nodes from the cloud database scoped to current user
  async function loadCameras() {
    const { data } = await scopedSupabase.from('cameras').select('*').eq('user_id', user?.id);
    setCameras(data || []);
  }

  /**
   * GLOBAL UPDATE HANDLER
   * The central logic that processes detection events from any node in the network.
   * Updates global alerts, charts, and node metrics simultaneously.
   */
  const handleGlobalUpdate = useCallback((match, camera, personCount, logMsg, confidence = 0) => {
    if (match) {
      const imgUrl = match.image_url || match.photo_url;
      setLastMatchOnNode({ ...match, image_url: imgUrl, cameraName: camera.name, confidence });
      setLocalNodeStats(prev => ({ totalDetections: prev.totalDetections + 1, lastConf: confidence }));

      // Alert Logic: Prevents notification spam by using a 10-second debounce per subject
      setGlobalAlerts(prev => {
        const index = prev.findIndex(a => a.id === match.id)
        const now = Date.now()
        const det = { timestamp: now, camera: camera.name, location: camera.location, coordinates: camera.coordinates, confidence: confidence || match.confidence || 0 }
        
        if (index !== -1) {
          if (now - prev[index].detections[prev[index].detections.length - 1].timestamp < 30000) return prev
          const updated = [...prev]; 
          updated[index] = { ...updated[index], lastSeen: now, detections: [...updated[index].detections, det] }; 
          return updated;
        }
        return [{ ...match, image_url: imgUrl, lastSeen: now, detections: [det] }, ...prev]
      })
    }

    // Charting Logic: Calculates 'Neural Load' based on scene complexity and identification status
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLiveStats(prev => {
      let load = Math.floor(Math.random() * 10) + 35; // Base idle load
      if (personCount > 0) load += 15;                 // Processing human traffic
      if (match) load = 94;                           // High load during active identification
      const signal = confidence || (Math.floor(Math.random() * 8) + 5);
      const newData = [...prev, { time, load, signal }];
      return newData.slice(-15) // Keep only the latest 15 data points for clarity
    })
  }, [])

  // Adds a new camera node to the surveillance grid and syncs to Supabase
  const handleAddCamera = async (data) => {
    const newCamera = {
      id: `cam-${Date.now()}`,
      ...data,
      status: 'ONLINE',
      user_id: user?.id
    };

    const { error } = await scopedSupabase.from('cameras').insert([newCamera]);

    if (error) {
      console.error('Error adding camera:', error);
      alert('Failed to add camera');
      return;
    }

    setCameras(prev => [...prev, newCamera]);
    setShowAddModal(false);
  }
  
  // Removes a camera node from Supabase and performs UI cleanup
  const handleDeleteCamera = async (id, e) => {
    e.stopPropagation();
    releaseStream(id);

    const { error } = await scopedSupabase.from('cameras').delete().eq('id', id);

    if (error) {
      console.error('Error deleting camera:', error);
      alert('Failed to delete camera');
      return;
    }

    setCameras(prev => prev.filter(c => c.id !== id));
    if (selectedCamera?.id === id) setSelectedCamera(null);
  }

  return (
    <div className="min-h-screen bg-[#080a10] text-slate-300 font-sans p-3 sm:p-6 tracking-tight overflow-x-hidden">
      
      {/* HEADER: Branding and User Session Info */}
      <header className="flex flex-wrap items-center justify-between mb-6 sm:mb-8 border-b border-white/5 pb-4 sm:pb-6 gap-3">
        <div className="flex items-center gap-4">
          <Shield className="text-blue-500" size={26} />
          <div>
            <h1 className="text-lg font-bold text-white uppercase tracking-tight leading-none">VigiByte</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">Network Command Center v6.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-6">
          {user?.role === 'admin' && <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase transition-all shadow-lg active:scale-95 border border-blue-400/20 whitespace-nowrap"><span className="hidden sm:inline">+ Add New Node</span><span className="sm:hidden">+</span></button>}
          <div className="flex items-center gap-2 sm:gap-4 pl-3 sm:pl-6 border-l border-white/10">
            <div className="text-right hidden sm:block">
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

      {/* KPI GRID: Real-time high-level metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <KPICard label="Active Nodes" value={cameras.length} icon={<Server size={18}/>} color="blue" />
        <KPICard label="Identified Threats" value={globalAlerts.length} icon={<AlertCircle size={18}/>} color="red" />
        <KPICard label="Neural Load" value={`${liveStats.length > 0 ? liveStats[liveStats.length-1].load : 0}%`} icon={<Cpu size={18}/>} color="slate" />
        <KPICard label="Link Status" value={linkStatus} icon={<Globe size={18}/>} color={linkStatus === 'ENCRYPTED' ? 'green' : linkStatus === 'CONNECTING' ? 'slate' : 'red'} />
      </div>

      {/* NODE GRID: Visual status of all surveillance nodes */}
      <section className="mb-10">
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-5 px-1 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Node Network Grid
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-5">
          {cameras.map(cam => (
            <div key={cam.id} className="relative group">
              <button onClick={() => { setSelectedCamera(cam); setLocalNodeStats({totalDetections: 0, lastConf: 0}); setLastMatchOnNode(null); setDetectedCriminals([]); }} className={`w-full aspect-video rounded-2xl border-2 transition-all relative overflow-hidden bg-slate-900 ${selectedCamera?.id === cam.id ? 'border-blue-500 shadow-2xl scale-[1.02]' : 'border-white/5 hover:border-blue-500/30'}`}>
                <GridNode camera={cam} criminals={criminals} onUpdate={handleGlobalUpdate} />
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 px-3 py-2 text-[9px] font-bold uppercase text-slate-300 border-t border-white/5 truncate">{cam.name}</div>
              </button>
              {user?.role === 'admin' && <button onClick={(e) => handleDeleteCamera(cam.id, e)} className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 rounded-full p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white border border-white/10 z-20 shadow-xl"><X size={10} /></button>}
            </div>
          ))}
        </div>
      </section>

      {/* ANALYTICS & REPOSITORY: Charts and Database management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
            <ChartContainer title="Processing Load" icon={<Cpu size={14}/>}><ResponsiveContainer width="100%" height={180}><BarChart data={liveStats}><Bar dataKey="load" radius={[4, 4, 0, 0]} barSize={20}>{liveStats.map((e, i) => <Cell key={i} fill={e.load > 85 ? '#FF4040' : '#00AAFF'} />)}</Bar><Tooltip cursor={{fill: 'rgba(255,255,255,0.1)'}} contentStyle={{background: '#1a1f2e', border: '2px solid #00AAFF', borderRadius: '12px', fontSize: '11px', color: '#00AAFF', fontWeight: 'bold'}} /><XAxis dataKey="time" tick={{fontSize: 8, stroke: '#ffffff', fill: '#ffffff'}} /></BarChart></ResponsiveContainer></ChartContainer>
            <ChartContainer title="Neural Match Signal" icon={<Activity size={14}/>}><ResponsiveContainer width="100%" height={180}><AreaChart data={liveStats}><defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="signal" stroke="#3b82f6" strokeWidth={2.5} fill="url(#p)" /><Tooltip contentStyle={{background: '#0a0d14', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px'}} /></AreaChart></ResponsiveContainer></ChartContainer>
        </div>
        <div className="lg:col-span-8 bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden flex flex-col">
            <div className="flex bg-black/20 p-2 gap-2 border-b border-white/5">
              <TabBtn active={activeTab === 'alerts'} label="THREAT HISTORY" onClick={() => setActiveTab('alerts')} icon={<Bell size={14}/>} />
              {user?.role !== 'viewer' && <TabBtn active={activeTab === 'database'} label="DATABASE" onClick={() => setActiveTab('database')} icon={<Database size={14}/>} />}
            </div>
            <div className="p-8 h-[530px] overflow-y-auto custom-scrollbar">
                {activeTab === 'alerts' ? (
                  <AlertPanel alerts={globalAlerts} onViewImage={setViewingImageUrl} />
                ) : user?.role !== 'viewer' ? (
                  <CriminalDB criminals={criminals} onRefresh={loadCriminals} supabase={scopedSupabase} userRole={user?.role} user={user} />
                ) : (
                  <div className="py-12 text-center opacity-50"><AlertCircle size={40} className="mx-auto mb-4 text-slate-600" /><p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">View-only Access - Database Management Disabled</p></div>
                )}
            </div>
        </div>
      </div>

      {/* INSPECTOR CORE MODAL: Deep-dive view for specific nodes */}
      {selectedCamera && (
        <div className="fixed inset-0 sm:inset-1 z-[100] flex justify-center p-0 sm:p-6 backdrop-blur-md bg-black/70 transition-all duration-300">
          <div className="bg-[#0c101f] w-full max-w-7xl rounded-2xl sm:rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-3 sm:p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex flex-col">
                  <h2 className="text-sm font-bold text-white uppercase tracking-tight leading-none">Inspector Core: {selectedCamera.name}</h2>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest"><MapPin size={10} className="text-blue-500" /> Site: {selectedCamera.location} | {selectedCamera.coordinates}</div>
                </div>
                <button onClick={() => setSelectedCamera(null)} className="p-2.5 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-white/10"><X size={22}/></button>
            </div>
            <div className="p-3 sm:p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-10 overflow--y-auto max-h-[85vh]">
                <div className="lg:col-span-2">
                  <CameraFeed 
                    activeCamera={selectedCamera} 
                    onAlert={(match, camera, count, log, conf) => handleGlobalUpdate(match, selectedCamera, count, log, conf)} 
                    user={user}
                    onDetectedCriminalsChange={setDetectedCriminals}
                  />
                </div>
                <div className="space-y-4">
                  <DetectedCriminalsPanel 
                    criminals={detectedCriminals}
                    onViewImage={setViewingImageUrl}
                  />
                </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE VIEWER: Full-resolution subject inspection */}
      {viewingImageUrl && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-lg flex items-center justify-center p-8 animate-in fade-in" onClick={() => setViewingImageUrl(null)}>
            <div className="bg-[#0c0f16] border border-white/10 rounded-[2.5rem] p-8 relative shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setViewingImageUrl(null)} className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-lg border-2 border-white hover:bg-red-500 active:scale-95 transition-all z-20"><X size={16} /></button>
                <img src={viewingImageUrl} className="w-full max-w-[85vw] max-h-[75vh] rounded-2xl object-contain border border-white/10 shadow-2xl" alt="Match Fullscreen" />
                <div className="pt-6 flex justify-center">
                    <a href={viewingImageUrl} download={`criminal_snap_${Date.now()}.jpg`} target="_blank" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg active:scale-95">
                        <Download size={14}/> Download Image
                    </a>
                </div>
            </div>
        </div>
      )}

      {showAddModal && <AddNodeModal onAdd={handleAddCamera} onClose={() => setShowAddModal(false)} />}
    </div>
  )
}

/**
 * DETECTED CRIMINALS PANEL
 * Displays a list of subjects identified within the currently inspected node.
 */
function DetectedCriminalsPanel({ criminals, onViewImage }) {
  const downloadImage = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'criminal-photo.jpg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (criminals.length === 0) {
    return (
      <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-6 text-center">
        <div className="text-slate-500 text-sm font-medium">✅ No threats detected</div>
        <div className="text-slate-600 text-[10px] uppercase font-bold tracking-widest mt-1">Scanning in progress...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div> Criminals Detected
        </h3>
        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
          {criminals.length} Active
        </span>
      </div>

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
        {criminals.map((criminal, idx) => (
          <CriminalCardCompact 
            key={criminal.id} 
            criminal={criminal}
            index={idx}
            onViewImage={onViewImage}
            onDownload={downloadImage}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * COMPACT CRIMINAL CARD
 * Displays individual subject details, confidence score, and detection metrics.
 */
function CriminalCardCompact({ criminal, index, onViewImage, onDownload }) {
  const timeSinceFirst = Math.round((criminal.lastSeen - criminal.firstSeen) / 1000)
  const imageUrl = criminal.photo_url || criminal.image_url
  
  return (
    <div 
      className="bg-slate-900/50 border-2 border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all shadow-xl"
      style={{ animation: `slideIn 0.3s ease-out ${index * 0.1}s both` }}>
      <div className="flex gap-3">
        <div className="relative group flex-shrink-0">
          {imageUrl ? (
            <>
              <img 
                src={imageUrl} 
                alt={criminal.name}
                className="w-16 h-16 rounded-lg object-cover border-2 border-red-500/50 cursor-pointer"
                onClick={() => onViewImage(imageUrl)}
              />
              <div className="absolute inset-0 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity h-16 flex items-center justify-center gap-1">
                <button onClick={() => onViewImage(imageUrl)} className="bg-white-600 p-1.5 rounded" title="View"><Eye size={12} className="text-white" /></button>
              </div>
            </>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center text-2xl">👤</div>
          )}
          <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900">
            {criminal.confidence}%
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-white font-bold text-sm mb-0.5 truncate">{criminal.name}</h4>
          <p className="text-red-400 text-xs font-medium mb-2">{criminal.crime}</p>
          <div className="flex flex-wrap gap-1.5 text-[9px]">
            <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold uppercase">Age: {criminal.age || 'N/A'}</span>
            <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase border border-red-500/30">{criminal.risk_level || 'Medium'}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-400">
            <span className="flex items-center gap-1"><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>{criminal.detectionCount}x</span>
            <span>•</span>
            <span>{timeSinceFirst}s</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ADD NODE MODAL
 * Purpose: Form to integrate new surveillance hardware (Webcam/IP/Static) into the registry.
 */
function AddNodeModal({ onAdd, onClose }) {
  const [formData, setFormData] = useState({ name: '', location: '', coordinates: '', type: 'webcam', source: '' })

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
          <div><label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Node Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="ENTRY_CAM_01" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all" required /></div>
          <div><label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Location</label><input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="Main Entrance" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all" required /></div>
          <div><label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Coordinates</label><input type="text" value={formData.coordinates} onChange={(e) => setFormData({...formData, coordinates: e.target.value})} placeholder="28.61, 77.20" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all" /></div>
          <div><label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Camera Type</label><select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"><option value="webcam" className="bg-slate-900">📹 Webcam (Local Camera)</option><option value="ip" className="bg-slate-900">🌐 IP Camera (RTSP/HTTP Stream)</option><option value="image" className="bg-slate-900">🖼️ Static Image (Upload)</option></select></div>
          {formData.type === 'ip' && (<div><label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Stream URL</label><input type="url" value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})} placeholder="rtsp://192.168.1.100:554/stream" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all" /></div>)}
          {formData.type === 'image' && (<div><label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Image URL</label><input type="url" value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})} placeholder="https://example.com/camera-image.jpg" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all" /></div>)}
          <div className="flex gap-3 pt-4"><button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold uppercase text-sm transition-all">Add Node</button><button type="button" onClick={onClose} className="px-6 border border-white/5 text-slate-500 py-3 rounded-xl text-sm font-bold uppercase transition-all">Cancel</button></div>
        </form>
      </div>
    </div>
  )
}

// Visual indicator card for Key Performance Indicators
function KPICard({ icon, label, value, color }) {
  const themes = { blue: 'border-blue-500/10 bg-blue-500/5 text-blue-500', red: 'border-red-500/10 bg-red-500/5 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.05)]', green: 'border-emerald-500/10 bg-emerald-500/5 text-emerald-500', slate: 'border-white/5 bg-white/[0.02] text-slate-300' }
  return ( <div className={`border rounded-[1.5rem] sm:rounded-[1.8rem] p-4 sm:p-7 transition-all hover:translate-y-[-2px] ${themes[color]}`}><div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 opacity-60 font-bold uppercase text-[9px] sm:text-[10px] tracking-[0.1em]">{icon} {label}</div><p className="text-2xl font-bold tracking-tight">{value}</p></div> )
}

// Button component for switching between dashboard tabs
function TabBtn({ active, label, onClick, icon }) {
    return ( <button onClick={onClick} className={`flex-1 py-4 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl ${active ? 'bg-white/5 text-white shadow-sm' : 'text-slate-600 hover:text-slate-400'}`}>{icon} {label}</button> )
}

// Container for analytical charts with branding and icons
function ChartContainer({ title, children, icon }) {
    return ( <div className="bg-slate-900/30 border border-white/5 rounded-[2rem] p-7 shadow-sm"><div className="flex items-center gap-2 mb-8">{icon}<h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0">{title}</h4></div>{children}</div> )
}

/**
 * GRID NODE COMPONENT
 * Background surveillance module that performs low-frequency facial scanning 
 * for nodes not currently selected in the 'Inspector Core'.
 */
function GridNode({ camera, criminals, onUpdate }) {
  const videoRef = useRef(null)
  const criminalsRef = useRef(criminals)

  useEffect(() => {
    criminalsRef.current = criminals
  }, [criminals])

  useEffect(() => {
    let scanInterval = null
    let cancelled = false

    if (camera.type === 'webcam') {
      getStream(camera.id)
        .then(async stream => {
          if (cancelled) return
          if (videoRef.current) videoRef.current.srcObject = stream
          await new Promise(r => setTimeout(r, 5000))

          // Low-frequency pulse (12 seconds) to keep global states updated without heavy CPU usage
          scanInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2 || criminalsRef.current.length === 0) return;
            try {
              const matches = await detectAllCriminals(videoRef.current, criminalsRef.current)
              if (matches && matches.length > 0) {
                const bestMatch = matches[0]
                onUpdate(bestMatch, camera, matches.length, null, bestMatch.confidence)
              } else {
                onUpdate(null, camera, 0, null, 0)
              }
            } catch (e) { }
          }, 15000)
        })
        .catch(err => console.error('GridNode stream error:', err))
    }

    return () => {
      cancelled = true
      clearInterval(scanInterval)
    }
  }, [camera.id])

  return (
    <div className="w-full h-full relative">
      {camera.type === 'webcam' ? (
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      ) : (
        <img src={camera.source} crossOrigin="anonymous" className="w-full h-full object-cover" alt="feed" />
      )}
    </div>
  )
}