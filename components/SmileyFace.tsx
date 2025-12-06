import React, { useEffect, useRef } from 'react';
import { SystemState } from '../types';

interface SmileyFaceProps {
  isActive: boolean;
  volume: number; // 0 to 1
  state: SystemState;
}

export const SmileyFace: React.FC<SmileyFaceProps> = ({ isActive, volume, state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    // Animation State
    let blinkState = 0; // 0: open, 1: closed
    let nextBlinkTime = Date.now() + 2000;
    
    const drawEye = (x: number, y: number, size: number, color: string, mode: 'NORMAL' | 'SQUINT' | 'CLOSED' | 'WIDE', pupilOffset: {x:number, y:number} = {x:0, y:0}) => {
       ctx.strokeStyle = color;
       ctx.fillStyle = color;
       ctx.lineWidth = 3;

       ctx.beginPath();
       if (mode === 'CLOSED') {
           ctx.moveTo(x - size, y);
           ctx.lineTo(x + size, y);
           ctx.stroke();
           return;
       }

       // Eye Outline
       if (mode === 'SQUINT') {
           ctx.ellipse(x, y + 5, size, size * 0.6, 0, 0, Math.PI * 2);
       } else {
           ctx.ellipse(x, y, size, size * (mode === 'WIDE' ? 1.2 : 1), 0, 0, Math.PI * 2);
       }
       ctx.stroke();

       // Pupil
       const pupilSize = size * 0.4;
       ctx.beginPath();
       ctx.arc(x + pupilOffset.x, y + pupilOffset.y, pupilSize, 0, Math.PI * 2);
       ctx.fill();
    };

    const drawMouth = (x: number, y: number, width: number, color: string, mode: SystemState, vol: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();

        if (mode === 'OFFLINE') {
            // Flat line
            ctx.moveTo(x - width/2, y);
            ctx.lineTo(x + width/2, y);
            ctx.stroke();
            return;
        }

        if (mode === 'STANDBY') {
            // Smile
            ctx.beginPath();
            ctx.arc(x, y - 10, width/1.5, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
            return;
        }

        if (mode === 'RECEIVING') {
            // Waveform (Voice Input)
            // Amplify the volume visual for better feedback
            const amp = Math.max(5, vol * 100); 
            const segments = 20;
            const step = width / segments;
            
            ctx.moveTo(x - width/2, y);
            for(let i = 0; i <= segments; i++) {
                const px = (x - width/2) + (i * step);
                // Jittery random wave for input
                const py = y + (Math.sin(Date.now() / 50 + i) * amp * (Math.random() * 0.5 + 0.5));
                ctx.lineTo(px, py);
            }
            ctx.stroke();
            return;
        }

        if (mode === 'PROCESSING') {
            // Straight / Thinking mouth
            const offset = Math.sin(Date.now() / 200) * 2;
            ctx.moveTo(x - width/3, y + offset);
            ctx.lineTo(x + width/3, y - offset);
            ctx.stroke();
            return;
        }

        if (mode === 'TRANSMITTING') {
            // Output Waveform (Smoother)
            const amp = vol * 60; // Output volume is usually 0-1
            ctx.beginPath();
            ctx.ellipse(x, y, width/2 + (amp * 0.2), 5 + amp, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const time = Date.now();

      // Clear
      ctx.clearRect(0, 0, width, height);
      
      // Define Theme Colors based on State
      let primaryColor = '#00bcd4'; // Cyan (Standby)
      let glowColor = 'rgba(0, 188, 212, 0.2)';

      if (!isActive || state === 'OFFLINE') {
          primaryColor = '#546e7a'; // Grey
          glowColor = 'rgba(0,0,0,0)';
      } else if (state === 'RECEIVING') {
          primaryColor = '#00e676'; // Green
          glowColor = 'rgba(0, 230, 118, 0.2)';
      } else if (state === 'PROCESSING') {
          primaryColor = '#ffea00'; // Yellow
          glowColor = 'rgba(255, 234, 0, 0.2)';
      } else if (state === 'TRANSMITTING') {
          primaryColor = '#d500f9'; // Purple
          glowColor = 'rgba(213, 0, 249, 0.2)';
      }

      // Blink Logic
      if (isActive && time > nextBlinkTime) {
          blinkState = 1;
          if (time > nextBlinkTime + 150) {
              blinkState = 0;
              nextBlinkTime = time + 2000 + Math.random() * 3000;
          }
      }

      // --- DRAW FACE ---
      
      // 1. Background Glow
      if (isActive) {
        const gradient = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 180);
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 180, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Eyes
      const eyeSpacing = 70;
      const eyeY = centerY - 30;
      const eyeSize = 25;
      
      let leftEyeMode: 'NORMAL' | 'SQUINT' | 'CLOSED' | 'WIDE' = 'NORMAL';
      let rightEyeMode: 'NORMAL' | 'SQUINT' | 'CLOSED' | 'WIDE' = 'NORMAL';
      let pupilOffset = { x: 0, y: 0 };

      if (!isActive || state === 'OFFLINE') {
          leftEyeMode = 'CLOSED';
          rightEyeMode = 'CLOSED';
      } else if (blinkState === 1) {
          leftEyeMode = 'CLOSED';
          rightEyeMode = 'CLOSED';
      } else if (state === 'PROCESSING') {
          // THINKING ANIMATION
          // Squint one eye, look up/around
          leftEyeMode = 'SQUINT'; 
          rightEyeMode = 'NORMAL';
          
          // Slow drift
          pupilOffset.x = Math.sin(time / 1000) * 5;
          pupilOffset.y = -5 + Math.sin(time / 800) * 3;

          // Rapid Flick (The "Aha!" or calculation moment)
          if (time % 2000 > 1800) {
              pupilOffset.y -= 8; // Flick up
              rightEyeMode = 'WIDE'; // Widen slightly
          }
      } else if (state === 'RECEIVING') {
          // Alert / Listening
          leftEyeMode = 'WIDE';
          rightEyeMode = 'WIDE';
          // Jitter pupils slightly with volume
          const jitter = volume * 5;
          pupilOffset.x = (Math.random() - 0.5) * jitter;
          pupilOffset.y = (Math.random() - 0.5) * jitter;
      }

      // Render Left Eye
      drawEye(centerX - eyeSpacing, eyeY, eyeSize, primaryColor, leftEyeMode, pupilOffset);
      
      // Render Right Eye
      drawEye(centerX + eyeSpacing, eyeY, eyeSize, primaryColor, rightEyeMode, pupilOffset);

      // 3. Mouth
      const mouthY = centerY + 50;
      const mouthWidth = 100;
      drawMouth(centerX, mouthY, mouthWidth, primaryColor, state, volume);

      // 4. Scanlines (Retro effect)
      if (isActive) {
          ctx.fillStyle = `rgba(255, 255, 255, 0.03)`;
          for(let i=0; i<height; i+=4) {
              ctx.fillRect(0, i, width, 1);
          }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, volume, state]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={300} 
      className="w-full h-auto max-w-[400px] drop-shadow-[0_0_15px_rgba(0,0,0,1)]"
    />
  );
};