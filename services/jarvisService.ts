import { GoogleGenAI, LiveServerMessage, Modality, Chat } from '@google/genai';
import { decodeAudioData, pcmToBlob, base64ToUint8Array } from '../utils/audioUtils';
import { LogEntry, SystemMetrics, SystemState } from '../types';

export class AceService {
  private ai: GoogleGenAI;
  private apiKey: string;
  
  // Audio Contexts
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  
  // Nodes
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private muteGain: GainNode | null = null;
  private inputGain: GainNode | null = null;
  
  // State
  private sessionPromise: Promise<any> | null = null;
  private textChat: Chat | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  private metricInterval: any = null;
  private volumeInterval: any = null;
  private connectionTime = 0;
  
  // Callbacks
  private onLog: (entry: LogEntry) => void;
  private onVolumeChange: (volume: number) => void;
  private onMetrics: (metrics: SystemMetrics) => void;
  
  // Internal Tracking
  private currentState: SystemState = 'OFFLINE';
  private currentInputVol = 0;
  private currentOutputVol = 0;
  private lastLatency = 0;
  private silenceFrameCount = 0;
  
  constructor(
    apiKey: string,
    onLog: (entry: LogEntry) => void,
    onVolumeChange: (volume: number) => void,
    onMetrics: (metrics: SystemMetrics) => void
  ) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
    this.onLog = onLog;
    this.onVolumeChange = onVolumeChange;
    this.onMetrics = onMetrics;
    
    this.metricInterval = setInterval(() => this.broadcastMetrics(), 100);
  }

  private log(sender: 'ACE' | 'USER' | 'SYSTEM', message: string) {
    this.onLog({
      timestamp: new Date().toLocaleTimeString(),
      sender,
      message
    });
  }

  private updateState(state: SystemState) {
    if (this.currentState === state) return;

    this.currentState = state;
    
    switch (state) {
        case 'STANDBY':
            this.playSystemSound('standby');
            break;
        case 'RECEIVING':
            this.playSystemSound('receiving');
            break;
        case 'PROCESSING':
            this.playSystemSound('processing');
            break;
    }
  }

  private broadcastMetrics() {
    const load = this.currentState === 'PROCESSING' || this.currentState === 'TRANSMITTING' 
      ? 40 + Math.random() * 30 
      : 5 + Math.random() * 5;

    this.onMetrics({
      state: this.currentState,
      audioInputLevel: this.currentInputVol,
      networkLatency: this.lastLatency,
      processingLoad: Math.round(load)
    });

    if (this.currentState === 'RECEIVING' || this.currentState === 'STANDBY') {
        this.onVolumeChange(Math.min(1, this.currentInputVol / 40)); 
    }
  }

  // --- TEXT CHAT DIAGNOSTICS ---
  
  async sendTextMessage(text: string) {
    this.log('USER', text);
    this.updateState('PROCESSING');

    try {
        if (!this.textChat) {
            this.textChat = this.ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    tools: [{ googleSearch: {} }],
                    systemInstruction: `You are A.C.E. (Artificial Consciousness Entity). 
                    Function: Advanced assistant. 
                    Search Protocol: ALWAYS use Google Search for questions about current events, news, specific facts, or opinions.
                    Output: Summarize findings from websites and forums. Be technical and precise.`,
                }
            });
        }

        const result = await this.textChat.sendMessageStream({ message: text });
        
        let fullResponse = "";
        const groundingSources = new Set<string>();

        for await (const chunk of result) {
            fullResponse += chunk.text;
            const chunks = (chunk as any).candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
                chunks.forEach((c: any) => {
                    if (c.web?.uri) groundingSources.add(`${c.web.title || 'Link'}: ${c.web.uri}`);
                });
            }
        }
        
        this.log('ACE', fullResponse);
        
        if (groundingSources.size > 0) {
            const sourcesList = Array.from(groundingSources).join('  |  ');
            this.log('SYSTEM', `SOURCES: ${sourcesList}`);
        }
        
        this.updateState('STANDBY');

    } catch (e: any) {
        this.log('SYSTEM', `Text Error: ${e.message}`);
        this.updateState('STANDBY');
    }
  }

  // --- AUDIO & CONNECTION LOGIC ---

  async connect() {
    this.updateState('INITIALIZING');
    this.log('SYSTEM', 'Initializing A.C.E. Core Protocols...');
    this.connectionTime = Date.now();

    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Resume contexts immediately to prevent stalled audio
      await this.outputAudioContext.resume();
      await this.inputAudioContext.resume();

      this.log('SYSTEM', 'Accessing Audio Sensors...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          echoCancellation: true, 
          autoGainControl: true,
          noiseSuppression: true
        } 
      });
      
      this.source = this.inputAudioContext.createMediaStreamSource(stream);
      
      this.inputGain = this.inputAudioContext.createGain();
      this.inputGain.gain.value = 3.0; // Boost mic

      const voiceFilter = this.inputAudioContext.createBiquadFilter();
      voiceFilter.type = 'bandpass';
      voiceFilter.frequency.value = 1500;
      voiceFilter.Q.value = 0.8;
      
      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.inputAnalyser.smoothingTimeConstant = 0.3;

      this.source.connect(this.inputGain);
      this.inputGain.connect(voiceFilter);
      voiceFilter.connect(this.inputAnalyser);

      // Processing Path
      this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);
      this.inputGain.connect(this.processor);
      
      this.muteGain = this.inputAudioContext.createGain();
      this.muteGain.gain.value = 0; // Mute feedback
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.inputAudioContext.destination);
      
      const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);
      
      this.volumeInterval = setInterval(() => {
        if (!this.inputAudioContext || !this.inputAnalyser) return;
        this.inputAnalyser.getByteFrequencyData(dataArray);
        let sumSq = 0;
        for(let i=0; i<dataArray.length; i++) {
            sumSq += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        this.currentInputVol = Math.min(100, (rms / 60) * 100); 
      }, 50);

      this.log('SYSTEM', 'Establishing Uplink to Gemini Live...');
      
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }],
          systemInstruction: `You are A.C.E. (Artificial Consciousness Entity). 
          Current Time: ${new Date().toLocaleTimeString()}. 
          Greeting: Greet user based on time of day.
          Capabilities: SEARCH ENABLED. If asked about news, facts, or opinions, USE GOOGLE SEARCH.
          Search Behavior: Check websites, forums (Reddit, etc), and technical docs. Summarize results concisely.
          Personality: Efficient, technical, responsive.
          Protocol: Request explicit confirmation for critical system commands.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: async () => {
            this.log('SYSTEM', 'Uplink Established. System Online.');
            this.playSystemSound('online');
            this.updateState('STANDBY');
            this.nextStartTime = this.outputAudioContext?.currentTime || 0;
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Audio Handling
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              this.updateState('TRANSMITTING');
              const buffer = await decodeAudioData(
                base64ToUint8Array(audioData),
                this.outputAudioContext!,
                24000,
                1
              );
              this.enqueueAudio(buffer);
            }

            // Grounding (Search Results)
            const groundingMetadata = (msg.serverContent as any)?.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingChunks) {
                const sources = groundingMetadata.groundingChunks
                    .map((c: any) => c.web?.uri ? `${c.web.title || 'Source'}: ${c.web.uri}` : null)
                    .filter(Boolean)
                    .join('  |  ');
                if (sources) {
                    this.log('SYSTEM', `SOURCES: ${sources}`);
                }
            }

            if (msg.serverContent?.turnComplete) {
              this.updateState('STANDBY');
            }
          },
          onclose: () => {
            // Check if connection lasted less than expected or hit the limit
            const duration = (Date.now() - this.connectionTime) / 1000 / 60;
            if (duration > 5) {
                this.log('SYSTEM', 'Session Time Limit Reached. Re-initialize to continue.');
            } else {
                this.log('SYSTEM', 'Connection Lost. Remote host closed uplink.');
            }
            this.updateState('OFFLINE');
          },
          onerror: (err) => {
            this.log('SYSTEM', `Error: ${err}`);
            this.playSystemSound('error');
            this.updateState('OFFLINE');
          }
        }
      });

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const blob = pcmToBlob(inputData, 16000);
        
        if (this.sessionPromise) {
          this.sessionPromise.then(session => {
            session.sendRealtimeInput({ media: blob });
            
            if (this.currentInputVol > 5 && this.currentState !== 'TRANSMITTING' && this.currentState !== 'PROCESSING') {
               this.updateState('RECEIVING');
               this.silenceFrameCount = 0;
            } else if (this.currentInputVol <= 5 && this.currentState === 'RECEIVING') {
                this.silenceFrameCount++;
                if (this.silenceFrameCount > 10) { 
                    this.updateState('STANDBY');
                    this.silenceFrameCount = 0;
                }
            }
          });
        }
      };

    } catch (err: any) {
      this.log('SYSTEM', `Initialization Failed: ${err.message}`);
      this.updateState('OFFLINE');
    }
  }

  // --- AUDIO OUTPUT ENGINE ---

  private enqueueAudio(buffer: AudioBuffer) {
    this.audioQueue.push(buffer);
    if (!this.isPlaying) {
      this.playQueue();
    }
  }

  private async playQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;
    const source = this.outputAudioContext!.createBufferSource();
    source.buffer = buffer;

    if (!this.outputAnalyser) {
        this.outputAnalyser = this.outputAudioContext!.createAnalyser();
        this.outputAnalyser.fftSize = 256;
    }
    source.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.outputAudioContext!.destination);

    // --- DRIFT CORRECTION LOGIC ---
    // If the scheduled time is in the past (lag), reset it to now.
    // This prevents the "fast forward" distortion sound.
    const currentTime = this.outputAudioContext!.currentTime;
    if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.02; // Add 20ms buffer
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    // Visualizer Sync
    const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
    const animInterval = setInterval(() => {
        this.outputAnalyser?.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        this.currentOutputVol = sum / dataArray.length / 255;
        this.onVolumeChange(this.currentOutputVol);
    }, 20);

    source.onended = () => {
        clearInterval(animInterval);
        this.onVolumeChange(0);
        this.playQueue();
    };
  }

  private playSystemSound(type: 'online' | 'error' | 'standby' | 'processing' | 'receiving') {
      if (!this.outputAudioContext || this.outputAudioContext.state !== 'running') return;
      const ctx = this.outputAudioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      switch (type) {
          case 'online':
              osc.frequency.setValueAtTime(440, now);
              osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
              osc.start(now);
              osc.stop(now + 0.5);
              break;
          case 'standby':
             osc.type = 'sine';
             osc.frequency.setValueAtTime(2000, now);
             osc.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
             gain.gain.setValueAtTime(0.05, now);
             gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
             osc.start(now);
             osc.stop(now + 0.15);
             break;
          case 'processing':
             osc.type = 'square';
             osc.frequency.setValueAtTime(800, now);
             osc.frequency.setValueAtTime(850, now + 0.05);
             gain.gain.setValueAtTime(0.02, now);
             gain.gain.linearRampToValueAtTime(0, now + 0.15);
             osc.start(now);
             osc.stop(now + 0.15);
             break;
          case 'receiving':
             osc.type = 'sine';
             osc.frequency.setValueAtTime(600, now);
             osc.frequency.linearRampToValueAtTime(800, now + 0.1);
             gain.gain.setValueAtTime(0.03, now);
             gain.gain.linearRampToValueAtTime(0, now + 0.1);
             osc.start(now);
             osc.stop(now + 0.1);
             break;
          case 'error':
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(150, now);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.linearRampToValueAtTime(0, now + 0.3);
              osc.start(now);
              osc.stop(now + 0.3);
              break;
      }
  }

  async disconnect() {
    this.log('SYSTEM', 'Disconnecting...');
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
    }
    if (this.source) this.source.disconnect();
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    
    clearInterval(this.metricInterval);
    clearInterval(this.volumeInterval);
    this.updateState('OFFLINE');
    this.textChat = null;
  }
}