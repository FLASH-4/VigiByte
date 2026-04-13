import { useState } from 'react'
import { loadModels, getFaceDescriptor, getFaceDescriptorFromBackend, checkBackend } from '../lib/faceRecognition'
import { Download, FileStack, RefreshCw, Plus, Trash2, ShieldAlert, X, UploadCloud, FileJson, Save } from 'lucide-react'
import Papa from 'papaparse'

/**
 * IMAGE OPTIMIZATION UTILITY
 * Purpose: Resizes images to a standard width before processing.
 * Helps in maintaining consistent performance across different hardware.
 */
const resizeImage = (file, maxWidth = 640) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Quality 0.7 balances file size and facial detail
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

export default function CriminalDB({ criminals, onRefresh, supabase, userRole = 'viewer' }) {
  // --- COMPONENT STATES ---
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', age: '', crime: '', crime_date: '', danger_level: 'MEDIUM' })
  const [photoFile, setPhotoFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvMsg, setCsvMsg] = useState('')

  // --- CSV FEATURE SECTION ---

  // 1. FEATURE: DOWNLOAD CURRENT FORM AS CSV
  const downloadFormAsCSV = () => {
    const data = [{ 
      Name: form.name, 
      Age: form.age, 
      Crime: form.crime, 
      Date: form.crime_date, 
      Danger_Level: form.danger_level,
      Photo_URL: preview ? 'URL will be saved on Local File - Upload' : '',
      Face_Descriptor: ''
    }]
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `Draft_${form.name.replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  // 2. FEATURE: DOWNLOAD SPECIFIC RECORD FROM LIST
  const downloadRecordAsCSV = (criminal) => {
    const data = [{ Name: criminal.name, Age: criminal.age, Crime: criminal.crime, Date: criminal.crime_date, Danger_Level: criminal.danger_level, Photo_URL: criminal.photo_url || '', Face_Descriptor: criminal.face_descriptor ? JSON.stringify(Array.from(criminal.face_descriptor)) : '' }]
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `Record_${criminal.name.replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  // 3. FEATURE: EXPORT FULL DATABASE
  const exportToCSV = () => {
    if (criminals.length === 0) return alert("Database is empty")
    const exportData = criminals.map(c => ({ 
      Name: c.name, 
      Age: c.age, 
      Crime: c.crime, 
      Date: c.crime_date, 
      Danger_Level: c.danger_level,
      Photo_URL: c.photo_url || '',
      Face_Descriptor: c.face_descriptor ? JSON.stringify(Array.from(c.face_descriptor)) : ''
    }))
    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob); link.setAttribute('download', `SecureEye_Master_DB.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  // 4. FEATURE: BULK MERGE MULTIPLE CSV FILES
  async function handleBulkCSV(e) {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setCsvUploading(true)
    setCsvMsg('Merging files...')
    
    let allParsedData = []
    let processedFiles = 0

    files.forEach(file => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          allParsedData = [...allParsedData, ...results.data]
          processedFiles++

          if (processedFiles === files.length) {
            try {
              // Remove duplicates based on name
              const uniqueMap = new Map()
              allParsedData.forEach(item => {
                const key = (item.name || item.Name || `unknown_${Date.now()}_${Math.random()}`).toLowerCase().trim()
                uniqueMap.set(key, item)
              })

              const toInsert = Array.from(uniqueMap.values()).map(r => {
                let face_descriptor = []
                const rawDescriptor = r.Face_Descriptor || r.face_descriptor
                if (rawDescriptor) {
                  try {
                    const parsed = JSON.parse(rawDescriptor)
                    face_descriptor = Array.isArray(parsed) ? parsed : []
                  } catch(e) {
                    face_descriptor = []
                  }
                }

                return {
                  name: r.name || r.Name || 'Unknown Subject',
                  age: parseInt(r.age || r.Age) || null,
                  crime: r.crime || r.Crime || 'Unclassified',
                  crime_date: r.crime_date || r.Date || null,
                  danger_level: (r.danger_level || r.Danger_Level || 'MEDIUM').toUpperCase(),
                  photo_url: r.Photo_URL || r.photo_url || null,
                  face_descriptor: face_descriptor,
                }
              }).filter(r => r.name || r.crime || r.photo_url)

              setCsvMsg(`Inserting ${toInsert.length} records...`)

              // Process in batches of 50 to prevent network timeouts
              const BATCH_SIZE = 50
              let inserted = 0

              for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
                const batch = toInsert.slice(i, i + BATCH_SIZE)
                const { error } = await supabase
                  .from('criminals')
                  .insert(batch)
                
                if (error) {
                  console.error('Batch error:', error)
                  // Fallback: Individual insertion if batch fails
                  for (const record of batch) {
                    const { error: singleError } = await supabase
                      .from('criminals')
                      .insert([record])
                    if (!singleError) inserted++
                    else console.error('Single insert error:', singleError.message)
                  }
                } else {
                  inserted += batch.length
                }
                
                setCsvMsg(`Inserting... ${inserted}/${toInsert.length}`)
              }

              setCsvMsg(`✅ ${inserted} records successfully synced!`)
              onRefresh()

            } catch (err) {
              console.error('Merge error:', err)
              setCsvMsg('Error: ' + err.message)
            } finally {
              setCsvUploading(false)
            }
          }
        },
        error: (err) => {
          setCsvMsg('CSV parse error: ' + err.message)
          setCsvUploading(false)
        }
      })
    })
  }

  // --- CORE SYSTEM HANDLERS ---

  /**
   * ENROLLMENT HANDLER
   * Resizes image, extracts facial vectors, and saves record to Supabase.
   */
  async function handleSave() {
    if (!photoFile) { setMsg('Photo is Mandatory'); return }
    setSaving(true);
    setMsg('⚡ Optimizing Image & Scanning...');

    try {
      // Step 1: Optimize and resize photo
      const optimizedBase64 = await resizeImage(photoFile);

      // Step 2: Extract AI Facial Vector
      const backendAvailable = await checkBackend();
      let descriptorArray = null; 
      if (backendAvailable) {
        // Preference: Use Python backend for feature extraction
        descriptorArray = await getFaceDescriptorFromBackend(optimizedBase64);
        setMsg('✅ AI Descriptor Extracted!');
      } else {
        // Fallback: Browser-based extraction if server is down
        setMsg('⚠️ Backend offline — using browser model...');
        await loadModels();
        const img = new Image(); 
        img.src = preview; 
        await new Promise(r => img.onload = r);
        const descriptor = await getFaceDescriptor(img);
        if (!descriptor) throw new Error("Face not found");
        descriptorArray = Array.from(descriptor);
      }

      if (!descriptorArray) { setMsg('Face Not Found.'); setSaving(false); return }

      // Step 3: Upload photo to storage bucket
      let photo_url = null
      if (supabase && supabase.storage) {
        try {
          const { data: ud } = await supabase.storage.from('criminal-photos').upload(`${Date.now()}-${form.name}.jpg`, photoFile)
          if (ud) photo_url = supabase.storage.from('criminal-photos').getPublicUrl(ud.path).data.publicUrl
        } catch (e) { console.error("Storage upload error") }
      }

      // Step 4: Insert final data into database
      const { error } = await supabase.from('criminals').insert({
        name: form.name || 'Unknown Subject',
        age: parseInt(form.age) || null,
        crime: form.crime || 'Unclassified',
        crime_date: form.crime_date || null,
        danger_level: form.danger_level || 'MEDIUM',
        face_descriptor: descriptorArray,
        photo_url,
      })

      if (error) throw error
      setMsg('✅ Entry Successful!')
      
      // Cleanup UI
      setForm({ name: '', age: '', crime: '', crime_date: '', danger_level: 'MEDIUM' })
      setPhotoFile(null); setPreview(null); onRefresh()
      setTimeout(() => {
        setAdding(false)
        setMsg('') 
      }, 1500)
    } catch (err) { setMsg('Error: ' + err.message) } finally { setSaving(false) }
  }

  // Handle record deletion
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await supabase.from('criminals').delete().eq('id', deleteTarget.id); onRefresh() } 
    catch (e) { console.error(e) } finally { setDeleting(false); setDeleteTarget(null) }
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* --- MODAL COMPONENTS --- */}
      
      {/* Purge Record Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
          <div className="bg-[#0f121a] border border-white/10 rounded-2xl p-8 w-full max-w-sm space-y-6 shadow-2xl">
            <div className="text-center"><ShieldAlert size={48} className="text-red-500 mx-auto mb-4" /><h3 className="font-bold text-white text-lg uppercase">Purge Record</h3></div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 bg-white/5 text-slate-400 py-3 rounded-xl text-[10px] font-bold uppercase">Abort</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white py-3 rounded-xl text-[10px] font-bold uppercase">{deleting ? 'Purging...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200]" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={selectedImage.url} className="w-full rounded-2xl border border-white/10 shadow-2xl" alt="Subject" />
            <button onClick={() => setSelectedImage(null)} className="absolute -top-4 -right-4 bg-red-600 text-white p-2 rounded-full border-2 border-white shadow-xl"><X size={18}/></button>
          </div>
        </div>
      )}

      {/* --- UI TOOLBAR --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/[0.02] border border-white/5 p-4 sm:p-5 rounded-2xl gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-tight">Criminal Registry {userRole === 'viewer' && <span className="text-slate-500">(View-Only)</span>}</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{criminals.length} Active Records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2.5 text-slate-400 hover:text-white"><RefreshCw size={16}/></button>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-800 text-slate-200 text-[10px] font-bold uppercase rounded-xl border border-white/5 transition-all"><Download size={14}/> Full DB Export</button>
          {userRole !== 'viewer' && <button onClick={() => setAdding(!adding)} className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-xl shadow-lg">+ New Entry</button>}
        </div>
      </div>

      {/* --- BULK SYNC TOOL --- */}
      {userRole !== 'viewer' && (
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
           <FileStack size={16} className="text-blue-500" />
           <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bulk Import & Multi-Merge</h4>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex-grow flex flex-col items-center justify-center py-6 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-white/5 hover:border-blue-500/30 transition-all group">
             <UploadCloud size={24} className="text-slate-500 mb-2 group-hover:text-blue-400" />
             <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-slate-300">Select Multiple CSV Files to Sync</span>
             <input type="file" multiple accept=".csv" onChange={handleBulkCSV} disabled={csvUploading} className="hidden" />
          </label>
        </div>
        {csvMsg && <p className={`text-[10px] font-bold mt-4 uppercase ${csvMsg.includes('✅') ? 'text-emerald-500' : 'text-blue-500'}`}>{csvMsg}</p>}
      </div>
      )}

      {/* --- ENROLLMENT FORM --- */}
      {adding && userRole !== 'viewer' && (
        <div className="bg-[#0f121a] border border-white/10 rounded-2xl p-8 space-y-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
             <div className="space-y-1.5"><label className="text-[9px] font-bold text-slate-500 uppercase">Full Name <span className="text-slate-600">(optional)</span></label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white" /></div>
             <div className="space-y-1.5"><label className="text-[9px] font-bold text-slate-500 uppercase">Age <span className="text-slate-600">(optional)</span></label><input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white" /></div>
             <div className="space-y-1.5"><label className="text-[9px] font-bold text-slate-500 uppercase">Classification <span className="text-slate-600">(optional)</span></label><input value={form.crime} onChange={e => setForm({...form, crime: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white" /></div>
             <div className="space-y-1.5"><label className="text-[9px] font-bold text-slate-500 uppercase">Danger Level</label><select value={form.danger_level} onChange={e => setForm({...form, danger_level: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
             <div className="col-span-2"><input type="file" onChange={(e) => { const f = e.target.files[0]; if(f){ setPhotoFile(f); setPreview(URL.createObjectURL(f)) } }} className="w-full text-[10px] text-slate-500" /></div>
          </div>
          {preview && <img src={preview} className="w-20 h-20 rounded-xl border border-white/10 shadow-lg" />}
          {msg && <p className="text-[10px] font-bold uppercase text-blue-500">{msg}</p>}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
             <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2"><Save size={14}/> {saving ? 'Processing...' : 'Save to Cloud'}</button>
             <button onClick={downloadFormAsCSV} className="flex-1 bg-slate-800 text-slate-200 border border-white/5 py-3 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2"><FileJson size={14} className="text-emerald-500" /> Download as CSV</button>
             <button onClick={() => setAdding(false)} className="px-8 border border-white/5 text-slate-500 py-3 rounded-xl text-[10px] font-bold uppercase">Cancel</button>
          </div>
        </div>
      )}

      {/* --- REGISTRY LIST VIEW --- */}
      <div className="space-y-2 mt-6">
        {criminals.map(c => (
          <div key={c.id} className="bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] rounded-2xl p-4 flex items-center gap-5 transition-all group">
            <img src={c.photo_url} onClick={() => setSelectedImage({ url: c.photo_url, name: c.name })} className="w-12 h-12 rounded-xl object-cover border border-white/10 cursor-pointer" alt="subject" />
            <div className="flex-1">
              <p className="text-xs font-bold text-white uppercase tracking-tight">{c.name}{c.age ? `, ${c.age}` : ''}</p>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-1">{c.crime}</p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => downloadRecordAsCSV(c)} className="p-2 text-slate-400 hover:text-emerald-500 bg-white/5 rounded-lg"><FileJson size={16} /></button>
                {userRole === 'admin' && <button onClick={() => setDeleteTarget(c)} className="p-2 text-slate-400 hover:text-red-500 bg-white/5 rounded-lg"><Trash2 size={16} /></button>}
            </div>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${c.danger_level === 'HIGH' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{c.danger_level}</span>
          </div>
        ))}
      </div>
    </div>
  )
}