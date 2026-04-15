import { useState, useEffect, useCallback, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Shield, AlertCircle, Activity, X, Server, Bell, Database, Globe, MapPin, Cpu, Download, Eye, LogOut } from 'lucide-react'
import { loadModels, detectAllCriminals, checkBackend } from '../lib/faceRecognition'
import CameraFeed from './CameraFeed'
import AlertPanel from './AlertPanel'
import CriminalDB from './CriminalDB'
import { getStream, releaseStream, releaseAllStreams } from '../lib/streamManager'
import { supabase, createScopedClient } from '../lib/supabase'

/**
 * VIGIBYTE DASHBOARD
 * Purpose: Central Command Center for managing surveillance nodes and real-time AI analytics.
 * This component orchestrates the state for the entire application, including security alerts,
 * database records, and system health monitoring.
 */
export default function Dashboard({ user, onLogout }) {
  const scopedSupabase = createScopedClient(user?.id)
  const profileMenuRef = useRef(null)

  // --- STATE MANAGEMENT ---

  // Camera Nodes: Persisted in Supabase per-user
  const [cameras, setCameras] = useState([])

  const [selectedCamera, setSelectedCamera] = useState(null) // Currently focused camera in 'Inspector' mode

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

  // Officers Management (Admin Only)
  const [pendingOfficers, setPendingOfficers] = useState([])
  const [approvedOfficers, setApprovedOfficers] = useState([])
  const [isApproved, setIsApproved] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Effect to prevent background scrolling when the Inspector Modal is active
  useEffect(() => {
    document.body.style.overflow = selectedCamera ? 'hidden' : '';
  }, [selectedCamera])

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu])

  // Cleanup camera when revoked
  useEffect(() => {
    if (user?.role !== 'admin' && !isApproved) {
      console.log('Revoking access - stopping all camera streams');
      releaseAllStreams(); // Stop ALL active streams
      setSelectedCamera(null);
      setCameras([]);
      setCriminals([]);
      setGlobalAlerts([]);
      setDetectedCriminals([]);
    }
  }, [isApproved])

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
    if (user?.role === 'admin') loadOfficers();

    const subscriptions = [];

    // Real-time subscription: Auto-update when approved or revoked
    if (user?.role !== 'admin') {
      const channel = scopedSupabase.channel(`approved-${user?.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'approved_officers',
          filter: `user_id=eq.${user?.id}`
        }, () => {
          loadCameras();
          loadCriminals();
          setIsApproved(true);
        })
        .subscribe();
      subscriptions.push(channel);

      // Listen for account deletion (rejection)
      const channelDelete = scopedSupabase.channel(`user-delete-${user?.id}`)
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'users'
        }, (payload) => {
          // Check if it's the current user being deleted
          if (payload.old.id === user?.id) {
            console.log('Real-time: Current user deleted - showing alert and redirecting');
            alert('❌ Your registration was not approved by the admin. Please register again.');
            onLogout();
            // Ensure immediate redirect
            setTimeout(() => {
              window.location.href = '/register';
            }, 50);
          }
        })
        .subscribe();
      subscriptions.push(channelDelete);

      // Polling fallback: Check approval status every 300ms for faster rejection detection
      const pollInterval = setInterval(async () => {
        try {
          // Check if user still exists (rejection detection)
          const { data: userExists } = await scopedSupabase.from('users').select('id').eq('id', user?.id);
          if (!userExists || userExists.length === 0) {
            console.log('User deleted - showing alert and redirecting');
            clearInterval(pollInterval);
            alert('❌ Your registration was not approved by the admin. Please register again.');
            onLogout();
            // Ensure redirect happens immediately before any page reload
            setTimeout(() => {
              window.location.href = '/register';
            }, 100);
            return;
          }

          // Check approval status
          const { data: approved } = await scopedSupabase.from('approved_officers').select('*').eq('user_id', user?.id).eq('organization_id', user?.organization_id);
          const nowApproved = approved && approved.length > 0;

          if (nowApproved && !isApproved) {
            // Just got approved
            console.log('User approved - loading data');
            setIsApproved(true);
            loadCameras();
            loadCriminals();
          } else if (!nowApproved && isApproved) {
            // Just got revoked - this will trigger the useEffect cleanup
            console.log('User revoked - setting isApproved to false');
            setIsApproved(false);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 300);
      subscriptions.push(pollInterval);
    } else if (user?.role === 'admin') {
      // Admin: Listen for new officer registrations - no filter for INSERT
      const channelNewOfficers = scopedSupabase.channel(`new-officers-${user?.organization_id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'users'
        }, (payload) => {
          // Check if new user is an officer in this organization
          if (payload.new.role === 'officer' && payload.new.organization_id === user?.organization_id) {
            console.log('New officer registration detected - refreshing list');
            loadOfficers();
          }
        })
        .subscribe();
      subscriptions.push(channelNewOfficers);

      // Admin: Polling fallback to detect new pending officers (every 2 seconds)
      const pollNewOfficers = setInterval(async () => {
        try {
          const { data: officers } = await scopedSupabase.from('users').select('*').eq('role', 'officer').eq('organization_id', user?.organization_id);
          const { data: approved } = await scopedSupabase.from('approved_officers').select('user_id').eq('organization_id', user?.organization_id);
          const approvedIds = new Set(approved?.map(a => a.user_id) || []);
          const pending = (officers || []).filter(o => !approvedIds.has(o.id));

          // Update if pending count changed
          if (pending.length !== pendingOfficers.length) {
            console.log('Pending officers count changed - updating list');
            setPendingOfficers(pending);
            const approvedList = (officers || []).filter(o => approvedIds.has(o.id));
            setApprovedOfficers(approvedList);
          }
        } catch (err) {
          console.error('Polling error for new officers:', err);
        }
      }, 2000);
      subscriptions.push(pollNewOfficers);

      // Admin: Listen for officer deletions (rejections) - no filter for DELETE events
      const channelDeleteOfficers = scopedSupabase.channel(`delete-officers-${user?.organization_id}`)
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'users'
        }, (payload) => {
          // Check if deleted user was an officer
          if (payload.old.role === 'officer') {
            console.log('Officer deleted (rejected) - refreshing list');
            loadOfficers();
          }
        })
        .subscribe();
      subscriptions.push(channelDeleteOfficers);

      // Admin: Listen for officer list changes (approvals/revocations)
      const channelOfficerChanges = scopedSupabase.channel(`officer-changes-${user?.organization_id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'approved_officers'
        }, () => {
          console.log('Officer approval status changed - refreshing list');
          loadOfficers();
        })
        .subscribe();
      subscriptions.push(channelOfficerChanges);
    }

    return () => {
      subscriptions.forEach(sub => {
        if (typeof sub === 'number') {
          clearInterval(sub);
        } else {
          scopedSupabase.removeChannel(sub);
        }
      });
    };
  }, [user?.id, isApproved])

  // Fetches suspect records from the cloud database
  async function loadCriminals() {
    // Admin can see all criminals in organization
    if (user?.role === 'admin') {
      const { data } = await scopedSupabase.from('criminals').select('*').eq('organization_id', user?.organization_id);
      setCriminals(data || [])
      return;
    }

    // Officers/viewers only see if approved
    const { data: approved } = await scopedSupabase.from('approved_officers').select('*').eq('user_id', user?.id).eq('organization_id', user?.organization_id);
    if (!approved || approved.length === 0) {
      setCriminals([]);
      return;
    }

    const { data } = await scopedSupabase.from('criminals').select('*').eq('organization_id', user?.organization_id);
    setCriminals(data || [])
  }

  // Fetches camera nodes from the cloud database scoped to current organization
  async function loadCameras() {
    // Admin can see all cameras in organization
    if (user?.role === 'admin') {
      const { data } = await scopedSupabase.from('cameras').select('*').eq('organization_id', user?.organization_id);
      setCameras(data || []);
      return;
    }

    // Officers/viewers only see if approved
    const { data: approved } = await scopedSupabase.from('approved_officers').select('*').eq('user_id', user?.id).eq('organization_id', user?.organization_id);
    if (!approved || approved.length === 0) {
      setCameras([]);
      return;
    }

    const { data } = await scopedSupabase.from('cameras').select('*').eq('organization_id', user?.organization_id);
    setCameras(data || []);
  }

  // Load all officers and their approval status
  async function loadOfficers() {
    try {
      // Get all officers in org
      const { data: officers } = await scopedSupabase.from('users').select('*').eq('role', 'officer').eq('organization_id', user?.organization_id);

      // Get approved officers
      const { data: approved } = await scopedSupabase.from('approved_officers').select('user_id').eq('organization_id', user?.organization_id);
      const approvedIds = new Set(approved?.map(a => a.user_id) || []);

      // Separate pending and approved
      const pending = (officers || []).filter(o => !approvedIds.has(o.id));
      const approvedList = (officers || []).filter(o => approvedIds.has(o.id));

      setPendingOfficers(pending);
      setApprovedOfficers(approvedList);
    } catch (err) {
      console.error('Error loading officers:', err);
    }
  }

  // Approve an officer
  async function handleApproveOfficer(officerId, officerEmail) {
    try {
      const { error } = await scopedSupabase.from('approved_officers').insert([{
        organization_id: user?.organization_id,
        user_id: officerId,
        approved_by: user?.id
      }]);

      if (error) throw error;
      await loadOfficers();
    } catch (err) {
      console.error('Error approving officer:', err);
    }
  }

  // Reject/remove an officer
  async function handleRemoveOfficer(officerId) {
    try {
      // Check if officer is pending (not approved)
      const { data: approved } = await scopedSupabase.from('approved_officers').select('*').eq('user_id', officerId).eq('organization_id', user?.organization_id);
      const isPending = !approved || approved.length === 0;

      // If pending, delete their user account entirely
      if (isPending) {
        console.log('Rejecting pending officer:', officerId);
        // Use regular supabase (admin) instead of scoped for deletion
        const { error: deleteError } = await supabase.from('users').delete().eq('id', officerId);
        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }
        console.log('Officer deleted successfully from database');
        // Remove from pending list immediately in UI
        setPendingOfficers(prev => prev.filter(o => o.id !== officerId));
      } else {
        // If approved, just remove approval
        console.log('Revoking approved officer:', officerId);
        const { error } = await scopedSupabase.from('approved_officers').delete().eq('user_id', officerId).eq('organization_id', user?.organization_id);
        if (error) {
          console.error('Revoke error:', error);
          throw error;
        }
        console.log('Officer revoked successfully');
        // Remove from approved list immediately in UI
        setApprovedOfficers(prev => prev.filter(o => o.id !== officerId));
      }

      // Force reload officers from database
      setTimeout(async () => {
        await loadOfficers();
      }, 100);
    } catch (err) {
      console.error('Error removing officer:', err);
    }
  }

  // Delete current user account
  async function handleDeleteAccount() {
    const confirmDelete = window.confirm('⚠️ Are you sure you want to delete your account? This action cannot be undone.');
    if (!confirmDelete) return;

    try {
      // If admin, delete all organization data first
      if (user?.role === 'admin') {
        console.log('Admin account deletion - removing all organization data...');

        // Delete all cameras in organization
        const { error: camerasError } = await scopedSupabase.from('cameras').delete().eq('organization_id', user?.organization_id);
        if (camerasError) throw camerasError;

        // Delete all criminals in organization
        const { error: criminalsError } = await scopedSupabase.from('criminals').delete().eq('organization_id', user?.organization_id);
        if (criminalsError) throw criminalsError;

        // Delete all approved officers records
        const { error: approvalsError } = await scopedSupabase.from('approved_officers').delete().eq('organization_id', user?.organization_id);
        if (approvalsError) throw approvalsError;

        console.log('Organization data deleted successfully');
      }

      // Delete the user account
      const { error: userError } = await scopedSupabase.from('users').delete().eq('id', user?.id);
      if (userError) throw userError;

      console.log('User account deleted successfully');
      alert('✅ Your account has been deleted');
      onLogout();
      window.location.href = '/register';
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('❌ Error deleting account: ' + err.message);
    }
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
      organization_id: user?.organization_id,
      user_id: user?.id
    };

    const { error } = await scopedSupabase.from('cameras').insert([newCamera]);

    if (error) {
      console.error('Error adding camera:', error);
      alert(`Failed to add camera: ${error.message}`);
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
      <header className="flex flex-wrap items-center justify-between mb-6 sm:mb-8 border-b border-white/5 pb-4 sm:pb-6 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Shield className="text-blue-500 flex-shrink-0 w-5 sm:w-[26]" size={24} />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-white uppercase tracking-tight leading-none truncate">VigiByte</h1>
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">v6.0</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          {user?.role === 'admin' && <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-lg text-[9px] sm:text-[11px] font-bold uppercase transition-all shadow-lg active:scale-95 border border-blue-400/20 whitespace-nowrap"><span className="hidden sm:inline">+ Add Node</span><span className="sm:hidden">+</span></button>}
          <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-4 border-l border-white/10 relative" ref={profileMenuRef}>
            <div className="text-right">
              <p className="text-[8px] sm:text-[9px] font-bold text-white truncate max-w-[70px] sm:max-w-[100px]">{user?.email}</p>
              <p className="text-[7px] sm:text-[8px] text-slate-400 uppercase tracking-widest mt-0.5">{user?.role === 'admin' ? '🔑 ADMIN' : user?.role === 'officer' ? '👮 OFFICER' : '👁️ VIEWER'}</p>
            </div>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-7 sm:w-10 h-7 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg text-xs flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer active:scale-95"
              title="Click for account options"
            >
              {user?.email?.charAt(0).toUpperCase()}
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute top-12 right-0 bg-[#0c101f] border border-white/10 rounded-lg shadow-lg z-50 min-w-max">
                <button
                  onClick={() => {
                    handleDeleteAccount();
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-600/10 text-[12px] font-bold uppercase tracking-widest transition-colors border-t border-white/5 first:border-t-0"
                >
                  🗑️ Delete Account
                </button>
              </div>
            )}

            <button onClick={onLogout} className="p-1 sm:p-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 rounded transition-all border border-red-500/20 flex-shrink-0" title="Logout">
              <LogOut size={14} className="sm:hidden" />
              <LogOut size={16} className="hidden sm:block" />
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
            <div className="flex bg-black/20 p-2 gap-2 border-b border-white/5 flex-wrap">
              <TabBtn active={activeTab === 'alerts'} label="THREAT HISTORY" onClick={() => setActiveTab('alerts')} icon={<Bell size={14}/>} />
              {user?.role !== 'viewer' && <TabBtn active={activeTab === 'database'} label="DATABASE" onClick={() => setActiveTab('database')} icon={<Database size={14}/>} />}
              {user?.role === 'admin' && <TabBtn active={activeTab === 'officers'} label="OFFICERS" onClick={() => setActiveTab('officers')} icon={<Shield size={14}/>} />}
            </div>
            <div className="p-4 sm:p-8 h-[530px] overflow-y-auto scrollbar-hide">
                {activeTab === 'alerts' ? (
                  <AlertPanel alerts={globalAlerts} onViewImage={setViewingImageUrl} />
                ) : activeTab === 'officers' ? (
                  <div className="space-y-4">
                    {/* Pending Officers */}
                    {pendingOfficers.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-3">⏳ Pending Approval ({pendingOfficers.length})</h3>
                        <div className="space-y-2">
                          {pendingOfficers.map(officer => (
                            <div key={officer.id} className="bg-slate-800/50 border border-yellow-400/20 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-white truncate">{officer.email}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400">👮 Officer • Registered: {new Date(officer.created_at).toLocaleDateString()}</p>
                              </div>
                              <div className="flex gap-2 min-w-fit w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => handleApproveOfficer(officer.id, officer.email)}
                                  className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-3 py-2 sm:py-1.5 rounded text-xs sm:text-sm font-bold uppercase transition-all active:scale-95 cursor-pointer pointer-events-auto"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOfficer(officer.id)}
                                  className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 text-white px-3 py-2 sm:py-1.5 rounded text-xs sm:text-sm font-bold uppercase transition-all active:scale-95 cursor-pointer pointer-events-auto"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Approved Officers */}
                    {approvedOfficers.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">✓ Approved ({approvedOfficers.length})</h3>
                        <div className="space-y-2">
                          {approvedOfficers.map(officer => (
                            <div key={officer.id} className="bg-slate-800/30 border border-green-400/20 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-white truncate">{officer.email}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400">👮 Officer • Status: Active</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveOfficer(officer.id)}
                                className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 sm:py-1.5 rounded text-xs sm:text-sm font-bold uppercase transition-all active:scale-95 cursor-pointer pointer-events-auto"
                              >
                                Revoke
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pendingOfficers.length === 0 && approvedOfficers.length === 0 && (
                      <div className="py-12 text-center opacity-50">
                        <Shield size={40} className="mx-auto mb-4 text-slate-600" />
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">No officers yet</p>
                      </div>
                    )}
                  </div>
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

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2 scrollbar-hide">
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