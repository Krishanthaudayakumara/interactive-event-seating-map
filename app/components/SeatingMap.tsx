'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Venue, Seat } from '../types';
import CanvasSeatingMap from './CanvasSeatingMap';

export default function SeatingMap() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [focusedSeat, setFocusedSeat] = useState<Seat | null>(null);
  const [mounted, setMounted] = useState(false);
  const [useLargeVenue, setUseLargeVenue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [wsEnabled, setWsEnabled] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [updatedSeats, setUpdatedSeats] = useState<Set<string>>(new Set());
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [adjacentCount, setAdjacentCount] = useState(2);
  const [highlightedSeats, setHighlightedSeats] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const venueFile = useLargeVenue ? '/venue-large.json' : '/venue.json';
      setVenue(null);
      setError(null);
      fetch(venueFile)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load venue data: ${res.status}`);
          return res.json();
        })
        .then(setVenue)
        .catch(err => {
          console.error('Error loading venue:', err);
          setError('Failed to load venue data. Please try again.');
        });
    }
  }, [mounted, useLargeVenue]);

  useEffect(() => {
    if (mounted) {
      const stored = localStorage.getItem('selectedSeats');
      if (stored) {
        setSelectedSeats(new Set(JSON.parse(stored)));
      }
    }
  }, [mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('selectedSeats', JSON.stringify([...selectedSeats]));
    }
  }, [selectedSeats, mounted]);

  useEffect(() => {
    if (!wsEnabled || !mounted) return;

    console.log('Establishing WebSocket connection...');
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'seat-update') {
          console.log(`📡 Seat update received: ${data.seatId} -> ${data.status}`);
          
          // Update seat status in venue
          setVenue(prev => {
            if (!prev) return prev;
            const newVenue = { ...prev };
            newVenue.sections = newVenue.sections.map(section => ({
              ...section,
              rows: section.rows.map(row => ({
                ...row,
                seats: row.seats.map(seat =>
                  seat.id === data.seatId
                    ? { ...seat, status: data.status }
                    : seat
                )
              }))
            }));
            return newVenue;
          });
          
          // Animate the updated seat
          setUpdatedSeats(prev => new Set(prev).add(data.seatId));
          setTimeout(() => {
            setUpdatedSeats(prev => {
              const next = new Set(prev);
              next.delete(data.seatId);
              return next;
            });
          }, 1000);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setWsConnected(false);
    };
    
    ws.onclose = (event) => {
      console.log(`🔌 WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
      setWsConnected(false);
    };
    
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      ws.close(1000, 'Component unmounting');
    };
  }, [wsEnabled, mounted]);

  const allSeats: Seat[] = useMemo(() => {
    if (!venue) return [];
    return venue.sections.flatMap(section =>
      section.rows.flatMap(row => row.seats)
    );
  }, [venue]);

  const findAdjacentSeats = useCallback(() => {
    if (!venue) return;

    for (const section of venue.sections) {
      for (const row of section.rows) {
        const availableSeats = row.seats.filter(s => s.status === 'available');
        
        for (let i = 0; i <= availableSeats.length - adjacentCount; i++) {
          const consecutive = [];
          for (let j = 0; j < adjacentCount; j++) {
            if (i + j < availableSeats.length && 
                availableSeats[i + j].col === availableSeats[i].col + j) {
              consecutive.push(availableSeats[i + j]);
            } else {
              break;
            }
          }
          
          if (consecutive.length === adjacentCount) {
            setHighlightedSeats(new Set(consecutive.map(s => s.id)));
            setFocusedSeat(consecutive[0]);
            return;
          }
        }
      }
    }

    alert(`No ${adjacentCount} adjacent seats found`);
    setHighlightedSeats(new Set());
  }, [venue, adjacentCount]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (seat.status !== 'available') return;
    
    setFocusedSeat(seat);
    setSelectedSeats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seat.id)) {
        newSet.delete(seat.id);
      } else if (newSet.size < 8) {
        newSet.add(seat.id);
        setShowLimitWarning(false);
      } else {
        setShowLimitWarning(true);
        setTimeout(() => setShowLimitWarning(false), 3000);
      }
      return newSet;
    });
  }, []);

  const clearSelection = () => {
    setSelectedSeats(new Set());
    setShowLimitWarning(false);
  };

  const handleFocus = (seat: Seat) => {
    setFocusedSeat(seat);
  };

  const handleKeyDown = (event: React.KeyboardEvent, seat: Seat) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSeatClick(seat);
    }
  };

  const getSeatDetails = (seat: Seat) => {
    const section = venue?.sections.find(s => s.rows.some(r => r.seats.some(se => se.id === seat.id)));
    const row = section?.rows.find(r => r.seats.some(se => se.id === seat.id));
    return `Section ${section?.label}, Row ${row?.index}, Seat ${seat.col}, Price Tier ${seat.priceTier}, Status: ${seat.status}`;
  };

  const getSeatFill = (seat: Seat) => {
    if (selectedSeats.has(seat.id)) return '#3b82f6'; // blue for selected
    if (seat.status === 'available') return '#22c55e'; // green for available
    if (seat.status === 'reserved') return '#f59e0b'; // orange for reserved
    if (seat.status === 'sold') return '#ef4444'; // red for sold
    return '#9ca3af'; // gray for held
  };

  const subtotal = useMemo(() => {
    return [...selectedSeats].reduce((sum, id) => {
      const seat = allSeats.find(s => s.id === id);
      return sum + (seat ? seat.priceTier * 10 : 0);
    }, 0);
  }, [selectedSeats, allSeats]);

  const seatCount = allSeats.length;
  const availableCount = allSeats.filter(s => s.status === 'available').length;
  const isLargeVenue = seatCount > 1000;
  const seatSize = isLargeVenue ? 8 : seatCount < 100 ? 18 : 12;

  // Don't render anything until mounted to avoid hydration mismatch from browser extensions
  if (!mounted) {
    return null;
  }

  if (!venue) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          {error ? (
            <div>
              <div className="text-red-600 dark:text-red-400 mb-4">⚠️ {error}</div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reload Page
              </button>
            </div>
          ) : (
            <div className="animate-pulse text-gray-600 dark:text-gray-400">Loading venue data...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto min-h-screen bg-white dark:bg-gray-900" suppressHydrationWarning>
      {/* WebSocket Status Banner */}
      {wsEnabled && (
        <div className={`mb-4 p-3 border rounded-lg flex items-center justify-between ${wsConnected ? 'bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200'}`}>
          <span>
            {wsConnected ? '🟢 Live updates connected' : '🟡 Connecting to live updates...'}
          </span>
          <button 
            onClick={() => {
              setWsEnabled(false);
              setWsConnected(false);
            }}
            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Limit Warning Banner */}
      {showLimitWarning && (
        <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 rounded-lg text-yellow-800 dark:text-yellow-200 flex items-center justify-between">
          <span>⚠️ Maximum 8 seats can be selected</span>
          <button 
            onClick={() => setShowLimitWarning(false)}
            className="text-yellow-600 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-100"
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{venue.name}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {seatCount.toLocaleString()} total seats • {availableCount.toLocaleString()} available
          </p>
        </div>
        
        {/* Feature Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowHeatMap(!showHeatMap)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap ${showHeatMap ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            aria-label="Toggle heat-map view"
          >
            🔥 Heat-Map
          </button>
          {!wsEnabled && (
            <button
              onClick={() => setWsEnabled(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors whitespace-nowrap"
              aria-label="Enable live WebSocket updates"
            >
              📡 Live Updates
            </button>
          )}
          <button
            onClick={() => {
              setUseLargeVenue(!useLargeVenue);
              setSelectedSeats(new Set()); // Clear selection when switching
              setFocusedSeat(null);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
            aria-label={useLargeVenue ? 'Switch to small venue' : 'Test with 15,000 seats'}
          >
            {useLargeVenue ? '📊 Small Venue' : '🚀 15K Seats'}
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CanvasSeatingMap
            seats={allSeats}
            width={venue.map.width}
            height={venue.map.height}
            selectedSeats={selectedSeats}
            focusedSeat={focusedSeat}
            onSeatClick={handleSeatClick}
            updatedSeats={updatedSeats}
            showHeatMap={showHeatMap}
            highlightedSeats={highlightedSeats}
          />
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-900 dark:text-gray-100">
            {showHeatMap ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#22c55e] border border-gray-300"></div>
                  <span>Tier 1 (Low)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#84cc16] border border-gray-300"></div>
                  <span>Tier 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#fbbf24] border border-gray-300"></div>
                  <span>Tier 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#f97316] border border-gray-300"></div>
                  <span>Tier 4</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#ef4444] border border-gray-300"></div>
                  <span>Tier 5 (High)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#3b82f6] border border-gray-300"></div>
                  <span>Selected</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#22c55e] border border-gray-300"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#3b82f6] border border-gray-300"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#f59e0b] border border-gray-300"></div>
                  <span>Reserved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#ef4444] border border-gray-300"></div>
                  <span>Sold</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#9ca3af] border border-gray-300"></div>
                  <span>Held</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Adjacent Seats Finder */}
          <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Find Adjacent Seats</h2>
            <div className="flex gap-2">
              <input
                type="number"
                min="2"
                max="8"
                value={adjacentCount}
                onChange={(e) => setAdjacentCount(parseInt(e.target.value) || 2)}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                aria-label="Number of adjacent seats"
              />
              <button
                onClick={findAdjacentSeats}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Find {adjacentCount} Seats
              </button>
            </div>
            {highlightedSeats.size > 0 && (
              <div className="mt-2 text-sm text-purple-600 dark:text-purple-400">
                ✓ Found {highlightedSeats.size} adjacent seats (highlighted in purple)
              </div>
            )}
          </div>

          {/* Selection Summary */}
          <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Selected Seats ({selectedSeats.size}/8)</h2>
              {selectedSeats.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  aria-label="Clear all selected seats"
                >
                  Clear All
                </button>
              )}
            </div>
            {selectedSeats.size > 0 ? (
              <>
                <ul className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                  {[...selectedSeats].map(id => {
                    const seat = allSeats.find(s => s.id === id);
                    return seat ? (
                      <li key={id} className="text-sm text-gray-900 dark:text-gray-100">
                        {seat.id} - Tier {seat.priceTier} - ${seat.priceTier * 10}
                      </li>
                    ) : null;
                  })}
                </ul>
                <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Subtotal: ${subtotal}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No seats selected</p>
            )}
          </div>
          
          {/* Seat Details */}
          {focusedSeat && (
            <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 shadow-sm">
              <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Seat Details</h2>
              <dl className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                <div className="flex justify-between">
                  <dt className="font-medium">Section:</dt>
                  <dd>{venue.sections.find(s => s.rows.some(r => r.seats.some(se => se.id === focusedSeat.id)))?.label}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Row:</dt>
                  <dd>{venue.sections.find(s => s.rows.some(r => r.seats.some(se => se.id === focusedSeat.id)))?.rows.find(r => r.seats.some(se => se.id === focusedSeat.id))?.index}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Seat:</dt>
                  <dd>{focusedSeat.col}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Price Tier:</dt>
                  <dd>{focusedSeat.priceTier}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Status:</dt>
                  <dd className="capitalize">{focusedSeat.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-medium">Price:</dt>
                  <dd>${focusedSeat.priceTier * 10}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}