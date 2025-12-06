import React, { useEffect, useRef } from 'react';

interface ArcReactorProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

export const ArcReactor: React.FC<ArcReactorProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let rotation = 0;
    let innerRotation = 0;

    const draw = () => {
      if (!ctx || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Clear
      ctx.clearRect(0, 0, width, height);
      
      if (!isActive) {
        // Dim/Off state
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
        ctx.strokeStyle = '#004d40';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#002220';
        ctx.fill();
        return;
      }

      // Dynamic variables for animation
      const vol = Math.max(0, Math.min(1, volume)); // Clamp 0-1
      
      // Speed up rotation based on volume
      rotation += 0.02 + (vol * 0.2);
      innerRotation -= 0.01 + (vol * 0.15);
      
      // Jitter effect for high energy (bass hits)
      const jitter = vol > 0.4 ? (Math.random() - 0.5) * vol * 4 : 0;

      // --- LAYER 1: Core Glow ---
      const glowPulse = Math.sin(Date.now() / 200) * 5;
      const glowSize = 50 + (vol * 70) + glowPulse;
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, glowSize);
      gradient.addColorStop(0, `rgba(220, 255, 255, ${0.9})`); // Core center
      gradient.addColorStop(0.3, `rgba(0, 200, 255, ${0.5 + vol * 0.3})`); // Mid glow
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fade out
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 2: Solid Inner Core ---
      ctx.beginPath();
      ctx.arc(centerX + jitter, centerY + jitter, 25 + (vol * 8), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(224, 247, 250, 0.9)';
      ctx.shadowBlur = 15 + (vol * 20);
      ctx.shadowColor = '#00e5ff';
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow

      // Save context for rotational transforms
      ctx.save();
      ctx.translate(centerX, centerY);

      // --- LAYER 3: Outer Static Ring (Expands with volume) ---
      ctx.beginPath();
      ctx.arc(0, 0, 85 + (vol * 5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 188, 212, ${0.3 + vol * 0.4})`;
      ctx.lineWidth = 2 + (vol * 3);
      ctx.stroke();

      // --- LAYER 4: Rotating Mechanical Ring (Clockwise) ---
      ctx.save();
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI * 1.6); // Open circle
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Tech details on the ring
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.stroke();
      ctx.restore();

      // --- LAYER 5: Inner Rotating Ring (Counter-Clockwise) ---
      ctx.save();
      ctx.rotate(innerRotation);
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 1.2);
      ctx.strokeStyle = '#84ffff';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Triangle markers on inner ring
      for(let i=0; i<3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.fillStyle = '#e0f7fa';
        ctx.beginPath();
        ctx.moveTo(50, 0);
        ctx.lineTo(45, -3);
        ctx.lineTo(45, 3);
        ctx.fill();
      }
      ctx.restore();

      // --- LAYER 6: Audio Reactive Ticks (The "Visualizer") ---
      const tickCount = 32;
      ctx.save();
      // Rotate the entire tick assembly slowly over time
      ctx.rotate(Date.now() / 2000); 
      
      for(let i=0; i<tickCount; i++) {
        ctx.rotate((Math.PI * 2) / tickCount);
        
        // Dynamic tick length: Base + Volume + Sine Wave Pattern
        const wave = Math.sin((Date.now() / 500) + (i * 0.5)); // Traveling wave
        const length = 15 + (vol * 40) + (wave * 8 * vol);
        
        // Tick Line
        ctx.beginPath();
        ctx.moveTo(95, 0);
        ctx.lineTo(95 + length, 0);
        ctx.strokeStyle = `rgba(0, 255, 255, ${0.2 + vol * 0.8})`;
        ctx.lineWidth = 2 + (vol * 2);
        ctx.stroke();

        // Tip Dot
        ctx.beginPath();
        ctx.arc(95 + length + 4, 0, 2 + (vol * 2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + vol})`;
        ctx.fill();
      }
      ctx.restore();

      ctx.restore(); // End translation

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, volume]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={400} 
      className="transition-opacity duration-1000 w-full h-auto max-w-[350px] drop-shadow-[0_0_15px_rgba(0,255,255,0.3)]"
    />
  );
};