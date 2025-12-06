export interface LogEntry {
  timestamp: string;
  sender: 'ACE' | 'USER' | 'SYSTEM';
  message: string;
}

export interface AudioVisualizerState {
  isSpeaking: boolean;
  volume: number;
}

export type SystemState = 'OFFLINE' | 'INITIALIZING' | 'STANDBY' | 'RECEIVING' | 'PROCESSING' | 'TRANSMITTING';

export interface SystemMetrics {
  state: SystemState;
  audioInputLevel: number; // 0-100
  networkLatency: number; // ms
  processingLoad: number; // %
}