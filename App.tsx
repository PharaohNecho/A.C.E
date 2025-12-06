import React, { useState, useEffect, useRef } from 'react';
import { SmileyFace } from './components/SmileyFace';
import { LogPanel } from './components/LogPanel';
import { AceService } from './services/jarvisService';
import { LogEntry, SystemMetrics } from './types';

function App() {
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [volume, setVolume] = useState(0);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    state: 'OFFLINE',
    audioInputLevel: 0,
    networkLatency: 0,
    processingLoad: 0
  });
  const [inputText, setInputText] = useState('');
  
  // API Key Management for Public/GitHub Pages Deployment
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const aceRef = useRef<AceService | null>(null);

  useEffect(() => {
    // 1. Check Environment Variable (Local Dev)
    const envKey = process.env.API_KEY;
    if (envKey) {
        setApiKey(envKey);
        return;
    }

    // 2. Check Local Storage (Deployed)
    const storedKey = localStorage.getItem('ace_api_key');
    if (storedKey) {
        setApiKey(storedKey);
    } else {
        // 3. Prompt User
        setShowKeyModal(true);
    }
  }, []);

  const handleSaveKey = () => {
      if (tempKey.trim().length > 10) {
          localStorage.setItem('ace_api_key', tempKey.trim());
          setApiKey(tempKey.trim());
          setShowKeyModal(false);
      }
  };

  const addLog = (entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  };

  const handleVolumeChange = (vol: number) => {
    // Smoother volume for mouth animation
    setVolume(prev => (vol * 0.6) + (prev * 0.4));
  };
  
  const handleMetricsUpdate = (newMetrics: SystemMetrics) => {
    setMetrics(newMetrics);
  };

  const toggleSystem = async () => {
    if (isActive) {
      if (aceRef.current) {
        await aceRef.current.disconnect();
      }
      setIsActive(false);
      aceRef.current = null;
    } else {
      if (!apiKey) {
        setShowKeyModal(true);
        return;
      }

      const ace = new AceService(
        apiKey,
        addLog,
        handleVolumeChange,
        handleMetricsUpdate
      );
      
      try {
        await ace.connect();
        aceRef.current = ace;
        setIsActive(true);
      } catch (e) {
        console.error(e);
        setIsActive(false);
      }
    }
  };

  const emergencyKill = async () => {
      if (aceRef.current) {
          addLog({ timestamp: new Date().toLocaleTimeString(), sender: 'SYSTEM', message: 'MANUAL KILL SWITCH TRIGGERED.' });
          await aceRef.current.disconnect();
      }
      setIsActive(false);
      aceRef.current = null;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !aceRef.current || !isActive) return;

    await aceRef.current.sendTextMessage(inputText);
    setInputText('');
  };

  // Status Badge Color Helper
  const getStatusColor = (state: string) => {
    switch (state) {
      case 'OFFLINE': return 'text-red-500';
      case 'STANDBY': return 'text-cyan-300';
      case 'RECEIVING': return 'text-emerald-400';
      case 'PROCESSING': return 'text-yellow-400';
      case 'TRANSMITTING': return 'text-purple-400';
      default: return 'text-gray-500';
    }
  };

  // Helper for segmented bar
  const renderSegmentedBar = (value: number, count: number) => {
    const segments = [];
    const activeSegments = Math.ceil((value / 100) * count);
    for (let i = 0; i < count; i++) {
        let color = 'bg-gray-800';
        if (i < activeSegments) {
            if (i < count * 0.6) color = 'bg-emerald-500';
            else if (i < count * 0.8) color = 'bg-yellow-400';
            else color = 'bg-red-500';
        }
        segments.push(
            <div 
                key={i} 
                className={`flex-1 h-full rounded-sm mx-[1px] ${color} transition-colors duration-75`}
            ></div>
        );
    }
    return segments;
  };

  return (
    <div className="relative w-full min-h-screen bg-black text-cyan-500 overflow-x-hidden flex flex-col font-tech">
      {/* Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* HUD Corners - Hidden on mobile to save space */}
      <div className="hidden lg:block absolute top-0 left-0 p-8 border-l-4 border-t-4 border-cyan-600 w-32 h-32 opacity-60 rounded-tl-3xl"></div>
      <div className="hidden lg:block absolute top-0 right-0 p-8 border-r-4 border-t-4 border-cyan-600 w-32 h-32 opacity-60 rounded-tr-3xl"></div>
      <div className="hidden lg:block absolute bottom-0 left-0 p-8 border-l-4 border-b-4 border-cyan-600 w-32 h-32 opacity-60 rounded-bl-3xl"></div>
      <div className="hidden lg:block absolute bottom-0 right-0 p-8 border-r-4 border-b-4 border-cyan-600 w-32 h-32 opacity-60 rounded-br-3xl"></div>

      {/* EMERGENCY KILL BUTTON */}
      <button 
        onClick={emergencyKill}
        className="absolute top-4 right-4 z-50 bg-red-950/80 border border-red-500 text-red-500 px-4 py-2 text-xs font-bold tracking-widest hover:bg-red-500 hover:text-black transition-all rounded"
      >
        KILL SWITCH
      </button>

      {/* Main Container */}
      <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8 w-full max-w-7xl mx-auto p-4 lg:p-12 flex-grow h-screen max-h-screen">
        
        {/* Left Panel: Status & Info */}
        <div className="order-2 lg:order-1 flex flex-col justify-center">
           <div className="border border-cyan-800 bg-black/80 p-4 lg:p-6 rounded backdrop-blur-md shadow-[0_0_20px_rgba(0,188,212,0.1)]">
              <h2 className="text-cyan-400 font-bold text-lg lg:text-xl mb-4 lg:mb-6 border-b border-cyan-900 pb-2 tracking-widest">A.C.E. STATUS DASHBOARD</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:space-y-6 lg:gap-0">
                 {/* Connection State */}
                 <div>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-cyan-700 text-xs tracking-wider">SYSTEM STATE</span>
                      <span className={`font-bold tracking-widest ${getStatusColor(metrics.state)} animate-pulse`}>
                        {metrics.state}
                      </span>
                   </div>
                   <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                     <div 
                        className={`h-full transition-all duration-300 ${isActive ? 'bg-cyan-500' : 'bg-red-900'}`}
                        style={{ width: isActive ? '100%' : '5%' }}
                     ></div>
                   </div>
                 </div>

                 {/* Latency */}
                 <div>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-cyan-700 text-xs tracking-wider">NETWORK LATENCY</span>
                      <span className="text-cyan-300 font-mono text-sm">{isActive ? `${metrics.networkLatency}ms` : '--'}</span>
                   </div>
                   <div className="flex gap-1 h-4 items-end">
                      {[...Array(10)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-1 transition-all duration-100 ${
                             isActive && i < (metrics.networkLatency / 15) ? 'bg-emerald-500' : 'bg-gray-800'
                          }`}
                          style={{ height: `${20 + Math.random() * 80}%` }}
                        ></div>
                      ))}
                   </div>
                 </div>

                 {/* Audio Input Level - Segmented Meter */}
                 <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                         <span className="text-cyan-700 text-xs tracking-wider">MIC SENSITIVITY</span>
                         {/* Visual Mic Indicator */}
                         <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 shadow-[0_0_5px_#22c55e] animate-pulse' : 'bg-red-900'}`}></div>
                      </div>
                      <span className={`font-mono text-sm ${isActive ? 'text-cyan-300' : 'text-red-900'}`}>
                          {isActive ? `${Math.round(metrics.audioInputLevel)}%` : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="w-full h-4 bg-black rounded border border-gray-800 flex p-[1px]">
                        {renderSegmentedBar(metrics.audioInputLevel, 30)}
                    </div>
                 </div>

                 {/* Processing Load */}
                 <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-cyan-700 text-xs tracking-wider">CPU LOAD</span>
                      <span className="text-cyan-300 font-mono text-sm">{metrics.processingLoad}%</span>
                    </div>
                    <div className="w-full h-20 lg:h-32 border border-cyan-900/50 relative overflow-hidden bg-black/50 p-2">
                       <svg className="w-full h-full" preserveAspectRatio="none">
                         <path 
                           d={`M0 100 Q 50 ${100 - metrics.processingLoad} 100 100`} 
                           fill="none" 
                           stroke="#00bcd4" 
                           strokeWidth="2"
                           className="drop-shadow-[0_0_5px_rgba(0,188,212,0.8)]"
                         />
                         <path 
                           d={`M0 100 Q 50 ${120 - metrics.processingLoad} 100 100`} 
                           fill="none" 
                           stroke="#4dd0e1" 
                           strokeWidth="1"
                           className="opacity-50"
                         />
                       </svg>
                    </div>
                 </div>

              </div>
           </div>
        </div>

        {/* Center Panel: Face & Controls */}
        <div className="order-1 lg:order-2 flex flex-col items-center justify-center gap-8 lg:gap-12 py-6 lg:py-0">
           <div className="relative group w-full flex justify-center flex-col items-center">
             
             {/* THE NEW GUI FACE */}
             <SmileyFace isActive={isActive} volume={volume} state={metrics.state} />
             
             {isActive && (
                <div className="mt-8 flex flex-col items-center w-full">
                  <div className="flex items-center gap-2 mb-2 bg-black/50 px-4 py-1 rounded-full border border-cyan-900">
                     <span className={`block w-2 h-2 rounded-full ${
                       metrics.state === 'RECEIVING' ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'
                     }`}></span>
                     <div className="text-cyan-200 font-tech text-sm tracking-[0.2em] whitespace-nowrap">
                       {metrics.state === 'OFFLINE' ? 'SYSTEM OFFLINE' : 
                        metrics.state === 'RECEIVING' ? 'MIC ACTIVE - LISTENING' : 
                        metrics.state === 'PROCESSING' ? 'ANALYZING INPUT' : 
                        metrics.state === 'TRANSMITTING' ? 'VOCALIZING' : 'STANDBY'}
                     </div>
                  </div>
                </div>
             )}
           </div>

           <div className="flex flex-col items-center gap-4">
             <button
               onClick={toggleSystem}
               className={`
                 font-tech text-xl px-12 lg:px-16 py-3 lg:py-4 rounded-full border-2 tracking-[0.2em] transition-all duration-300
                 hover:scale-105 active:scale-95 backdrop-blur-sm
                 shadow-[0_0_20px_rgba(0,255,255,0.1)]
                 ${isActive 
                   ? 'border-red-500 text-red-500 hover:bg-red-950/30 hover:shadow-[0_0_40px_rgba(255,0,0,0.3)]' 
                   : 'border-cyan-400 text-cyan-400 hover:bg-cyan-950/30 hover:shadow-[0_0_40px_rgba(0,255,255,0.3)] bg-black/40'
                 }
               `}
             >
               {isActive ? 'DEACTIVATE' : 'ACTIVATE A.C.E.'}
             </button>
             {!isActive && (
               <div className="text-cyan-800 text-xs tracking-widest animate-pulse">
                 TOUCH TO INITIALIZE PROTOCOLS
               </div>
             )}
           </div>
        </div>

        {/* Right Panel: Logs & Input */}
        <div className="order-3 flex flex-col h-64 lg:h-full overflow-hidden">
          <LogPanel logs={logs} />
          
          <form onSubmit={handleSendMessage} className="mt-2 border border-cyan-900/50 bg-black/80 rounded-lg overflow-hidden backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,255,0.1)] flex items-center p-2">
            <span className="text-emerald-400 font-bold mr-2 text-sm">&gt;</span>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isActive ? "Search query or command..." : "System offline"}
              disabled={!isActive}
              className="bg-transparent border-none outline-none text-cyan-300 font-mono text-sm flex-1 placeholder-cyan-900"
            />
            <button 
              type="submit" 
              disabled={!isActive || !inputText.trim()}
              className="text-cyan-600 hover:text-cyan-400 disabled:text-gray-800 uppercase text-xs font-bold tracking-wider px-2"
            >
              Send
            </button>
          </form>
        </div>

      </div>

      {/* Decorative lines */}
      <div className="hidden lg:block absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-900/30 to-transparent pointer-events-none"></div>
      <div className="hidden lg:block absolute left-1/2 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-900/30 to-transparent pointer-events-none"></div>

      {/* API Key Modal for GitHub Pages / No Env Support */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="bg-gray-900 border border-cyan-500 p-8 rounded-lg shadow-[0_0_50px_rgba(0,188,212,0.3)] max-w-md w-full">
                <h2 className="text-cyan-400 font-tech text-2xl mb-4 tracking-widest">SECURITY CLEARANCE</h2>
                <p className="text-cyan-100 text-sm mb-6 font-mono">
                    Identity verification required. Enter Gemini API Key to initialize A.C.E. protocols.
                </p>
                <input 
                    type="password" 
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="Paste API Key here..."
                    className="w-full bg-black border border-cyan-800 rounded p-3 text-cyan-300 font-mono outline-none focus:border-cyan-400 mb-6"
                />
                <div className="flex justify-end gap-4">
                    <button 
                        onClick={handleSaveKey}
                        className="bg-cyan-900/50 hover:bg-cyan-700 text-cyan-300 font-bold py-2 px-6 rounded transition-colors"
                    >
                        AUTHENTICATE
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-4 text-center">
                    Key is stored locally in your browser's encrypted storage.
                </p>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;