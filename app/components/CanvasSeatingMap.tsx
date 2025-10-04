'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Seat } from '../types';

interface CanvasSeatingMapProps {
  seats: Seat[];
  width: number;
  height: number;
  selectedSeats: Set<string>;
  focusedSeat: Seat | null;
  onSeatClick: (seat: Seat) => void;
  updatedSeats?: Set<string>;
  showHeatMap?: boolean;
  highlightedSeats?: Set<string>;
}

export default function CanvasSeatingMap({
  seats,
  width,
  height,
  selectedSeats,
  focusedSeat,
  onSeatClick,
  updatedSeats = new Set(),
  showHeatMap = false,
  highlightedSeats = new Set()
}: CanvasSeatingMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchMidpoint = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);
  
  const seatSize = seats.length < 100 ? 18 : seats.length < 1000 ? 12 : 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    seats.forEach(seat => {
      const x = seat.x * scaleX;
      const y = seat.y * scaleY;

      let fillColor;
      if (selectedSeats.has(seat.id)) {
        fillColor = '#3b82f6';
      } else if (highlightedSeats.has(seat.id)) {
        fillColor = '#a855f7';
      } else if (showHeatMap) {
        const colors = ['#22c55e', '#84cc16', '#fbbf24', '#f97316', '#ef4444'];
        fillColor = colors[Math.min(seat.priceTier - 1, 4)] || '#22c55e';
      } else {
        if (seat.status === 'available') {
          fillColor = '#22c55e';
        } else if (seat.status === 'reserved') {
          fillColor = '#f59e0b';
        } else if (seat.status === 'sold') {
          fillColor = '#ef4444';
        } else {
          fillColor = '#9ca3af';
        }
      }

      const rectSize = seatSize * scaleX;
      const cornerRadius = rectSize * 0.3;
      
      ctx.beginPath();
      ctx.roundRect(x - rectSize / 2, y - rectSize / 2, rectSize, rectSize, cornerRadius);
      ctx.fillStyle = fillColor;
      ctx.fill();

      if (focusedSeat?.id === seat.id) {
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }

      if (updatedSeats.has(seat.id)) {
        ctx.beginPath();
        ctx.arc(x, y, rectSize * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3 * dpr;
        ctx.stroke();
      }
    });

    ctx.restore();
  }, [seats, selectedSeats, focusedSeat, updatedSeats, showHeatMap, highlightedSeats, zoom, panX, panY, width, height]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const x = (canvasX - panX) / zoom / scaleX;
    const y = (canvasY - panY) / zoom / scaleY;

    const clickedSeat = seats.find(seat => {
      const halfSize = seatSize / 2 + 2;
      return (
        x >= seat.x - halfSize &&
        x <= seat.x + halfSize &&
        y >= seat.y - halfSize &&
        y <= seat.y + halfSize
      );
    });

    if (clickedSeat) {
      onSeatClick(clickedSeat);
    }
  }, [seats, width, height, zoom, panX, panY, seatSize, onSeatClick]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      lastTouchDistance.current = distance;
      lastTouchMidpoint.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    } else if (e.touches.length === 1) {
      isPanning.current = true;
      lastPanPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches.length === 2 && lastTouchDistance.current !== null && lastTouchMidpoint.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const scale = distance / lastTouchDistance.current;
      const newZoom = Math.max(0.5, Math.min(5, zoom * scale));
      
      const midX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const midY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
      
      // Adjust pan to zoom towards the midpoint of the pinch
      const zoomChange = newZoom / zoom;
      const newPanX = midX - (midX - panX) * zoomChange;
      const newPanY = midY - (midY - panY) * zoomChange;
      
      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
      lastTouchDistance.current = distance;
      lastTouchMidpoint.current = { x: midX, y: midY };
    } else if (e.touches.length === 1 && isPanning.current && lastPanPoint.current) {
      // Pan
      const touch = e.touches[0];
      const dx = touch.clientX - lastPanPoint.current.x;
      const dy = touch.clientY - lastPanPoint.current.y;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
      lastPanPoint.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [zoom, panX, panY]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    lastTouchMidpoint.current = null;
    isPanning.current = false;
    lastPanPoint.current = null;
  }, []);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.5, Math.min(5, zoom * delta));
    
    // Adjust pan to zoom towards mouse position
    const zoomChange = newZoom / zoom;
    const newPanX = mouseX - (mouseX - panX) * zoomChange;
    const newPanY = mouseY - (mouseY - panY) * zoomChange;
    
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="border border-gray-300 dark:border-gray-600 rounded-lg max-w-full bg-white cursor-pointer touch-none"
        style={{ width: '100%', height: 'auto', aspectRatio: `${width}/${height}` }}
        role="img"
        aria-label={`Interactive seating map with ${seats.length} seats. ${selectedSeats.size} seats selected. Click on available seats (shown in green) to select them.`}
        tabIndex={0}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {selectedSeats.size > 0 && `${selectedSeats.size} seat${selectedSeats.size === 1 ? '' : 's'} selected`}
      </div>
      {zoom !== 1 && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <button
            onClick={() => {
              setZoom(1);
              setPanX(0);
              setPanY(0);
            }}
            className="bg-black/70 hover:bg-black/90 text-white px-3 py-1 rounded-full text-sm transition-colors"
            title="Reset zoom"
          >
            Reset
          </button>
          <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            {zoom.toFixed(1)}x
          </div>
        </div>
      )}
    </div>
  );
}
