"use client";

import { useRef, useEffect } from "react";

interface WaveformVisualizerProps {
  audioLevel: number; // 0-1
  isActive: boolean;
}

const BAR_COUNT = 20;
const BAR_GAP = 2;

export function WaveformVisualizer({
  audioLevel,
  isActive,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame: number;
    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Shift bars left, add new bar
      barsRef.current.shift();
      barsRef.current.push(audioLevel);

      const barWidth = (width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        const barHeight = Math.max(2, barsRef.current[i] * height * 0.8);
        const x = i * (barWidth + BAR_GAP);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = "var(--color-voice-active, #ef4444)";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [audioLevel, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="h-10 w-full"
    />
  );
}
