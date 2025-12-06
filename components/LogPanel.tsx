import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Function to detect URLs and wrap them in <a> tags
  const renderMessage = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlRegex);
    
    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a 
                    key={index} 
                    href={part} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-cyan-300 underline hover:text-cyan-100 break-all"
                >
                    {part}
                </a>
            );
        }
        return part;
    });
  };

  return (
    <div className="flex-1 flex flex-col font-mono text-sm border border-cyan-900/50 bg-black/80 rounded-lg overflow-hidden backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,255,0.1)] min-h-0">
      <div className="bg-cyan-950/30 px-4 py-2 border-b border-cyan-900/50 flex justify-between items-center shrink-0">
        <span className="text-cyan-400 font-bold tracking-widest text-xs">TERMINAL_OUTPUT</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.length === 0 && (
          <div className="text-cyan-800 italic text-xs">Awaiting initialization sequence...</div>
        )}
        {logs.map((log, index) => (
          <div key={index} className="flex gap-3">
            <span className="text-cyan-700 text-xs whitespace-nowrap pt-1">[{log.timestamp}]</span>
            <div className="flex-1">
              <span className={`text-xs font-bold mr-2 ${
                log.sender === 'ACE' ? 'text-cyan-400' : 
                log.sender === 'USER' ? 'text-emerald-400' : 'text-yellow-500'
              }`}>
                {log.sender}&gt;
              </span>
              <span className={`text-gray-300 ${log.sender === 'SYSTEM' ? 'text-xs opacity-70' : ''}`}>
                {renderMessage(log.message)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};