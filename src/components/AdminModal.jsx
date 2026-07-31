import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, CheckCircle, AlertTriangle, Database, Sparkles, RefreshCw, Lock, Link as LinkIcon, Eye, EyeOff, ShieldCheck, Layers } from 'lucide-react';
import { uploadAndSyncCsv, verifyPassword, getSyncConfig, syncGoogleSheets, syncAllSheets, hasAuthToken, clearAuthToken } from '../utils/api';

const AdminModal = ({ isOpen, onClose, onSyncSuccess }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('sheets'); // 'sheets' | 'manual'
  
  const [selectedBatch, setSelectedBatch] = useState('2025-29');
  
  // Google Sheets states per batch
  const [sheetUrls, setSheetUrls] = useState({
    '2023-27': { mapping: '', theory: '', practical: '' },
    '2024-28': { mapping: '', theory: '', practical: '' },
    '2025-29': { mapping: '', theory: '', practical: '' }
  });
  const [useAi, setUseAi] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasServerApiKey, setHasServerApiKey] = useState(false);

  // Manual file upload states per batch
  const [files, setFiles] = useState({
    '2023-27': { mapping: null, theory: null, practical: null },
    '2024-28': { mapping: null, theory: null, practical: null },
    '2025-29': { mapping: null, theory: null, practical: null }
  });

  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [seededCount, setSeededCount] = useState(0);
  const [syncAllResults, setSyncAllResults] = useState(null);

  const fileInputRefs = {
    mapping: useRef(null),
    theory: useRef(null),
    practical: useRef(null)
  };

  useEffect(() => {
    if (isOpen) {
      if (hasAuthToken()) {
        handleResumeSession();
      } else {
        setIsAuthenticated(false);
        setStatus('idle');
      }
    }
  }, [isOpen]);

  const handleResumeSession = async () => {
    try {
      setStatus('loading');
      setStatusMsg('Resuming session...');
      setErrorMsg('');
      await loadConfig();
      setIsAuthenticated(true);
      setStatus('idle');
    } catch (err) {
      clearAuthToken();
      setIsAuthenticated(false);
      setStatus('idle');
      setErrorMsg('');
    }
  };

  const handleUnlock = async (passToVerify) => {
    const checkPass = passToVerify || password;
    if (!checkPass) {
      setErrorMsg('Please enter the administrator authorization password.');
      return;
    }

    try {
      setStatus('loading');
      setStatusMsg('Authorizing session...');
      setErrorMsg('');

      await verifyPassword(checkPass);
      setPassword('');
      setIsAuthenticated(true);
      await loadConfig();
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Authentication failed. Please verify the admin password.');
      setStatus('idle');
      setIsAuthenticated(false);
    }
  };

  const loadConfig = async () => {
    try {
      const config = await getSyncConfig();
      if (config.batches) {
        setSheetUrls({
          '2023-27': {
            mapping: config.batches['2023-27']?.mappingUrl || '',
            theory: config.batches['2023-27']?.theoryUrl || '',
            practical: config.batches['2023-27']?.practicalUrl || ''
          },
          '2024-28': {
            mapping: config.batches['2024-28']?.mappingUrl || '',
            theory: config.batches['2024-28']?.theoryUrl || '',
            practical: config.batches['2024-28']?.practicalUrl || ''
          },
          '2025-29': {
            mapping: config.batches['2025-29']?.mappingUrl || '',
            theory: config.batches['2025-29']?.theoryUrl || '',
            practical: config.batches['2025-29']?.practicalUrl || ''
          }
        });
      } else {
        setSheetUrls(prev => ({
          ...prev,
          '2025-29': {
            mapping: config.mappingUrl || '',
            theory: config.theoryUrl || '',
            practical: config.practicalUrl || ''
          }
        }));
      }
      setUseAi(!!config.useAi);
      setHasServerApiKey(!!config.hasApiKey);
      
      const savedKey = localStorage.getItem('groqApiKey');
      if (savedKey) setGroqApiKey(savedKey);
    } catch (err) {
      console.error('Failed to load sync configurations:', err);
      throw err;
    }
  };

  const handleFileChange = (type, file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Invalid file type. Please upload a .csv file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(`File ${file.name} exceeds the 5MB limit.`);
      return;
    }
    setFiles(prev => ({
      ...prev,
      [selectedBatch]: {
        ...prev[selectedBatch],
        [type]: file
      }
    }));
    setErrorMsg('');
  };

  const readFileText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const batchFiles = files[selectedBatch];
    if (!batchFiles.theory || !batchFiles.practical) {
      setErrorMsg('Please select at least Theory and Practical CSV files.');
      return;
    }

    try {
      setStatus('loading');
      setStatusMsg(`Ingesting files for Batch ${selectedBatch}...`);
      setErrorMsg('');
      setSyncAllResults(null);

      const [mappingText, theoryText, practicalText] = await Promise.all([
        batchFiles.mapping ? readFileText(batchFiles.mapping) : Promise.resolve(''),
        readFileText(batchFiles.theory),
        readFileText(batchFiles.practical)
      ]);

      const result = await uploadAndSyncCsv(selectedBatch, mappingText, theoryText, practicalText);
      setSeededCount(result.count);
      setStatus('success');
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error(err);
      if (err.message.includes('expired') || err.message.includes('log in')) {
        clearAuthToken();
        setIsAuthenticated(false);
      }
      setErrorMsg(err.message || 'Manual CSV sync failed.');
      setStatus('error');
    }
  };

  const handleSheetsSubmit = async (e) => {
    e.preventDefault();
    const batchUrls = sheetUrls[selectedBatch];
    if (!batchUrls.theory || !batchUrls.practical) {
      setErrorMsg('Please enter Google Sheet URLs for at least Theory and Practical schedules.');
      return;
    }

    try {
      setStatus('loading');
      setStatusMsg(useAi ? `AI-Assisted parsing & syncing for Batch ${selectedBatch}...` : `Syncing Google Sheets for Batch ${selectedBatch}...`);
      setErrorMsg('');
      setSyncAllResults(null);

      if (groqApiKey.trim()) {
        localStorage.setItem('groqApiKey', groqApiKey.trim());
      } else {
        localStorage.removeItem('groqApiKey');
      }

      const result = await syncGoogleSheets(
        selectedBatch,
        batchUrls.mapping,
        batchUrls.theory,
        batchUrls.practical,
        useAi,
        groqApiKey.trim() || null
      );

      setSeededCount(result.count);
      setStatus('success');
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error(err);
      if (err.message.includes('expired') || err.message.includes('log in')) {
        clearAuthToken();
        setIsAuthenticated(false);
      }
      setErrorMsg(err.message || 'Google Sheets sync failed.');
      setStatus('error');
    }
  };

  const handleSyncAll = async () => {
    try {
      setStatus('loading');
      setStatusMsg('Syncing all batches from saved links...');
      setErrorMsg('');
      setSyncAllResults(null);

      const result = await syncAllSheets();
      setSeededCount(result.totalCount);
      setSyncAllResults(result);
      setStatus('success');
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      console.error(err);
      if (err.message.includes('expired') || err.message.includes('log in')) {
        clearAuthToken();
        setIsAuthenticated(false);
      }
      setErrorMsg(err.message || 'Sync All Batches failed.');
      setStatus('error');
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
    setPassword('');
    setErrorMsg('');
  };

  const handleReset = () => {
    setFiles(prev => ({
      ...prev,
      [selectedBatch]: { mapping: null, theory: null, practical: null }
    }));
    setStatus('idle');
    setErrorMsg('');
    setSyncAllResults(null);
  };

  const handleClose = () => {
    if (status === 'loading') return;
    setErrorMsg('');
    setStatus('idle');
    setSyncAllResults(null);
    onClose();
  };

  const renderFileInput = (type, label, description) => {
    const isSelected = !!files[selectedBatch]?.[type];
    return (
      <div 
        onClick={() => fileInputRefs[type].current.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(type, e.dataTransfer.files[0]);
          }
        }}
        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
          isSelected 
            ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10' 
            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50 dark:bg-slate-900/50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className={`p-2 rounded-xl flex-shrink-0 ${isSelected ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {isSelected ? <CheckCircle size={18} /> : <UploadCloud size={18} />}
          </div>
          <div className="text-left min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{label}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{isSelected ? files[selectedBatch]?.[type]?.name : description}</p>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRefs[type]}
          onChange={(e) => handleFileChange(type, e.target.files[0])}
          accept=".csv"
          className="hidden"
        />
        <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex-shrink-0">
          {isSelected ? 'Change' : 'Upload'}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3 }}
            className="relative w-[95vw] sm:w-full max-w-lg overflow-hidden bg-white dark:bg-[#0c101c] border border-slate-200/90 dark:border-white/10 shadow-2xl rounded-3xl p-5 sm:p-8 z-10 text-left max-h-[88vh] overflow-y-auto"
          >
            <button
              onClick={handleClose}
              disabled={status === 'loading'}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors border border-slate-200 dark:border-white/5 active:scale-95"
            >
              <X size={18} />
            </button>

            <div className="space-y-4 sm:space-y-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white tracking-tight flex items-center gap-2 pr-8">
                  <Database className="text-emerald-600 dark:text-emerald-500 flex-shrink-0" size={20} />
                  <span>Update Schedule Database</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                  Manage MongoDB schedules via Sheets sync or CSV.
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-3 text-xs text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* 1. PASSWORD AUTHENTICATION SCREEN */}
                {!isAuthenticated ? (
                  <motion.form
                    key="auth-gate"
                    onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}
                    className="space-y-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="flex flex-col gap-2 p-5 sm:p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/5 rounded-2xl text-center items-center justify-center">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-500 mb-1 border border-emerald-200 dark:border-emerald-500/20">
                        <Lock size={20} />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Admin Session Authorization</h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-xs">Enter your authorization key to proceed.</p>
                    </div>

                    <div className="flex flex-col gap-2 relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter admin password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="w-full pl-4 pr-10 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-slate-900 dark:text-white transition-all min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="w-full px-4 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-95"
                    >
                      {status === 'loading' ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                      <span>Unlock Dashboard</span>
                    </button>
                  </motion.form>
                ) : status === 'loading' ? (
                  /* 2. LOADING STATE */
                  <motion.div
                    key="loading-indicator"
                    className="min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <RefreshCw className="w-9 h-9 sm:w-10 sm:h-10 text-emerald-600 dark:text-emerald-500 animate-spin mb-3" />
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                      {statusMsg}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed font-mono">
                      Updating MongoDB records. Do not close this window.
                    </p>
                  </motion.div>
                ) : status === 'success' ? (
                  /* 3. SUCCESS STATE */
                  <motion.div
                    key="success-screen"
                    className="min-h-[220px] flex flex-col items-center justify-center text-center p-5 sm:p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 dark:text-emerald-400 mb-2 animate-bounce" />
                    <h4 className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                      Sync Completed!
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 max-w-xs mb-3 font-sans">
                      Successfully seeded <span className="text-emerald-600 dark:text-emerald-400 font-bold">{seededCount}</span> student schedule slots!
                    </p>
                    
                    {syncAllResults && syncAllResults.results && (
                      <div className="w-full space-y-1.5 mb-4">
                        {syncAllResults.results.map(r => (
                          <div key={r.batch} className="flex justify-between text-xs px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl font-mono">
                            <span className="text-slate-700 dark:text-slate-300">Batch {r.batch}</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">{r.count} students</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2.5 sm:gap-3 w-full">
                      <button
                        onClick={handleReset}
                        className="flex-1 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-200 dark:border-white/5"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20"
                      >
                        Finish
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* 4. UNLOCKED ADMIN PANEL */
                  <motion.div
                    key="admin-unlocked"
                    className="space-y-3.5 sm:space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Navigation Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => { setActiveTab('sheets'); setErrorMsg(''); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
                          activeTab === 'sheets' 
                            ? 'bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/50 dark:border-white/5' 
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <LinkIcon size={13} />
                        <span>Google Sheets</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('manual'); setErrorMsg(''); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all ${
                          activeTab === 'manual' 
                            ? 'bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/50 dark:border-white/5' 
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <UploadCloud size={13} />
                        <span>Manual CSV</span>
                      </button>
                    </div>

                    {/* Batch Sub-navigation */}
                    <div className="flex bg-slate-100/70 dark:bg-slate-900/40 p-1 rounded-xl border border-slate-200/60 dark:border-white/5 items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-2">Batch:</span>
                      <div className="flex gap-1">
                        {['2023-27', '2024-28', '2025-29'].map((batch) => (
                          <button
                            key={batch}
                            type="button"
                            onClick={() => { setSelectedBatch(batch); setErrorMsg(''); }}
                            className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-mono font-bold rounded-lg transition-all ${
                              selectedBatch === batch
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {batch}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tab Panels */}
                    {activeTab === 'sheets' ? (
                      /* GOOGLE SHEETS FORM */
                      <form onSubmit={handleSheetsSubmit} className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mapping Sheet URL (Optional)</label>
                            <input
                              type="url"
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              value={sheetUrls[selectedBatch]?.mapping || ''}
                              onChange={(e) => setSheetUrls(prev => ({
                                ...prev,
                                [selectedBatch]: { ...prev[selectedBatch], mapping: e.target.value }
                              }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:outline-none text-xs text-slate-900 dark:text-white transition-all font-mono min-h-[40px]"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Theory Schedule Sheet URL</label>
                            <input
                              type="url"
                              required
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              value={sheetUrls[selectedBatch]?.theory || ''}
                              onChange={(e) => setSheetUrls(prev => ({
                                ...prev,
                                [selectedBatch]: { ...prev[selectedBatch], theory: e.target.value }
                              }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:outline-none text-xs text-slate-900 dark:text-white transition-all font-mono min-h-[40px]"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Practical Schedule Sheet URL</label>
                            <input
                              type="url"
                              required
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              value={sheetUrls[selectedBatch]?.practical || ''}
                              onChange={(e) => setSheetUrls(prev => ({
                                ...prev,
                                [selectedBatch]: { ...prev[selectedBatch], practical: e.target.value }
                              }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:outline-none text-xs text-slate-900 dark:text-white transition-all font-mono min-h-[40px]"
                            />
                          </div>

                          {/* AI Ingestion Toggle */}
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-white/5 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-left">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                                  <Sparkles size={14} className="text-emerald-600 dark:text-emerald-500" />
                                  <span>AI Self-Healing Parser</span>
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Auto-fix table format shifts via Groq LLM.</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={useAi}
                                onChange={(e) => setUseAi(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              />
                            </div>

                            {useAi && (
                              <div className="flex flex-col gap-1 pt-2 border-t border-slate-200 dark:border-white/5 relative">
                                <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Groq API Key</label>
                                <div className="relative">
                                  <input
                                    type={showApiKey ? "text" : "password"}
                                    placeholder={hasServerApiKey ? "Using server key..." : "gsk_..."}
                                    value={groqApiKey}
                                    onChange={(e) => setGroqApiKey(e.target.value)}
                                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:outline-none text-xs text-slate-900 dark:text-white font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                  >
                                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-1.5 space-y-2">
                          <button
                            type="button"
                            onClick={handleSyncAll}
                            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <Layers size={14} />
                            <span>Sync All Batches</span>
                          </button>

                          <div className="flex gap-2.5 sm:gap-3">
                            <button
                              type="button"
                              onClick={handleLogout}
                              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-200 dark:border-white/5 active:scale-95"
                            >
                              Lock
                            </button>
                            <button
                              type="submit"
                              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              <RefreshCw size={14} />
                              <span>Fetch & Sync Batch</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      /* MANUAL CSV FORM */
                      <form onSubmit={handleManualSubmit} className="space-y-2.5">
                        <div className="space-y-2">
                          {renderFileInput('mapping', 'Mapping CSV (Optional)', 'Upload Roll No ↔ Name mapping')}
                          {renderFileInput('theory', 'Theory Schedule', 'Upload theory dates & locations')}
                          {renderFileInput('practical', 'Practical Schedule', 'Upload lab viva slots')}
                        </div>

                        <div className="pt-1.5 flex gap-2.5 sm:gap-3">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all border border-slate-200 dark:border-white/5 active:scale-95"
                          >
                            Lock
                          </button>
                          <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <RefreshCw size={14} />
                            <span>Sync CSV Files</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AdminModal;
