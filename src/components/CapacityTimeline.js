import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, unwrap } from '../services/api';

/**
 * CapacityTimeline - Visual timeline showing printer availability
 * Gantt-chart style view for print scheduling
 */
function CapacityTimeline({ onScheduleJob }) {
  const [printers, setPrinters] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDays, setViewDays] = useState(3);
  const [startDate, setStartDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [hoveredJob, setHoveredJob] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load printers
      const printersRes = await api.getPrinters();
      const printersData = unwrap(printersRes);
      const printersList = Array.isArray(printersData) 
        ? printersData 
        : (printersData?.printers || printersData?.data || []);
      
      // Load jobs
      const jobsRes = await api.getJobQueue();
      const jobsData = unwrap(jobsRes);
      const jobsList = Array.isArray(jobsData) 
        ? jobsData 
        : (jobsData?.jobs || jobsData?.data || []);

      setPrinters(printersList.length > 0 ? printersList : getMockPrinters());
      setJobs(jobsList.length > 0 ? jobsList : getMockJobs());
    } catch (err) {
      console.error('Failed to load data:', err);
      setPrinters(getMockPrinters());
      setJobs(getMockJobs());
    } finally {
      setLoading(false);
    }
  };

  const getMockPrinters = () => [
    { name: 'Bambu X1C #1', status: 'idle', printer_type: 'bambu_x1c' },
    { name: 'Bambu X1C #2', status: 'printing', printer_type: 'bambu_x1c' },
    { name: 'Bambu P1S', status: 'idle', printer_type: 'bambu_p1s' },
    { name: 'Creality K1', status: 'idle', printer_type: 'creality_k1' },
  ];

  const getMockJobs = () => {
    const now = new Date();
    return [
      {
        id: 'job-1',
        name: 'Phone Stand x10',
        printer: 'Bambu X1C #2',
        status: 'printing',
        estimated_time_minutes: 180,
        started_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        progress: 35,
      },
      {
        id: 'job-2',
        name: 'Gear Assembly',
        printer: 'Bambu X1C #1',
        status: 'queued',
        estimated_time_minutes: 240,
        scheduled_start: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'job-3',
        name: 'Client Logo x5',
        printer: 'Bambu P1S',
        status: 'queued',
        estimated_time_minutes: 90,
        scheduled_start: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'job-4',
        name: 'Prototype v2',
        printer: 'Creality K1',
        status: 'queued',
        estimated_time_minutes: 360,
        scheduled_start: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  };

  // Generate time slots for the timeline
  const timeSlots = useMemo(() => {
    const slots = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    for (let d = 0; d < viewDays; d++) {
      for (let h = 0; h < 24; h++) {
        const slotTime = new Date(start.getTime() + (d * 24 + h) * 60 * 60 * 1000);
        slots.push({
          time: slotTime,
          hour: h,
          day: d,
          isWorkHour: h >= 8 && h <= 20,
          isNow: Math.abs(slotTime.getTime() - Date.now()) < 30 * 60 * 1000,
        });
      }
    }
    return slots;
  }, [startDate, viewDays]);

  // Get jobs for each printer
  const getJobsForPrinter = useCallback((printerName) => {
    return jobs.filter(job => 
      job.printer === printerName || 
      job.printer_name === printerName
    );
  }, [jobs]);

  // Calculate job position on timeline
  const getJobPosition = (job) => {
    const startTime = job.started_at 
      ? new Date(job.started_at)
      : job.scheduled_start 
        ? new Date(job.scheduled_start)
        : new Date();
    
    const duration = job.estimated_time_minutes || 60;
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    
    const timelineStart = new Date(startDate);
    timelineStart.setHours(0, 0, 0, 0);
    
    const timelineEnd = new Date(timelineStart.getTime() + viewDays * 24 * 60 * 60 * 1000);
    
    // Calculate position as percentage
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    const leftMs = Math.max(0, startTime.getTime() - timelineStart.getTime());
    const widthMs = Math.min(endTime.getTime(), timelineEnd.getTime()) - Math.max(startTime.getTime(), timelineStart.getTime());
    
    return {
      left: (leftMs / totalMs) * 100,
      width: Math.max((widthMs / totalMs) * 100, 1),
      visible: leftMs < totalMs && widthMs > 0,
      startTime,
      endTime,
    };
  };

  // Calculate printer availability
  const getPrinterAvailability = (printerName) => {
    const printerJobs = getJobsForPrinter(printerName);
    const now = Date.now();
    
    // Find the last job end time
    let lastEndTime = now;
    printerJobs.forEach(job => {
      const startTime = job.started_at 
        ? new Date(job.started_at).getTime()
        : job.scheduled_start 
          ? new Date(job.scheduled_start).getTime()
          : now;
      const duration = (job.estimated_time_minutes || 60) * 60 * 1000;
      const endTime = startTime + duration;
      if (endTime > lastEndTime) {
        lastEndTime = endTime;
      }
    });
    
    return {
      availableAt: new Date(lastEndTime),
      isAvailable: lastEndTime <= now,
      busyHours: Math.max(0, (lastEndTime - now) / (60 * 60 * 1000)),
    };
  };

  // Navigate timeline
  const navigateTimeline = (direction) => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + direction);
    setStartDate(newDate);
  };

  const goToToday = () => {
    setStartDate(new Date());
  };

  // Get job color based on status
  const getJobColor = (status) => {
    const colors = {
      printing: { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-400' },
      queued: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400' },
      paused: { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-400' },
      failed: { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-400' },
      completed: { bg: 'bg-slate-500', border: 'border-slate-400', text: 'text-slate-400' },
    };
    return colors[status] || colors.queued;
  };

  // Format time display
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get printer status icon
  const getPrinterStatusIcon = (status) => {
    const icons = {
      printing: '🟢',
      idle: '⚪',
      error: '🔴',
      offline: '⚫',
      paused: '🟡',
    };
    return icons[status] || '⚪';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">📅 Capacity Timeline</h2>
          <p className="text-slate-400 text-sm mt-1">
            {printers.length} printers • {jobs.length} scheduled jobs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Days Selector */}
          <select
            value={viewDays}
            onChange={(e) => setViewDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: '#334155' }}
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>1 Week</option>
          </select>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateTimeline(-viewDays)}
              className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10"
            >
              Today
            </button>
            <button
              onClick={() => navigateTimeline(viewDays)}
              className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              →
            </button>
          </div>

          <button
            onClick={loadData}
            className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Availability Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {printers.map(printer => {
          const availability = getPrinterAvailability(printer.name);
          return (
            <div 
              key={printer.name}
              className="p-3 rounded-xl border"
              style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{getPrinterStatusIcon(printer.status)}</span>
                <span className="text-sm font-medium text-white truncate">{printer.name}</span>
              </div>
              {availability.isAvailable ? (
                <p className="text-xs text-green-400">Available now</p>
              ) : (
                <p className="text-xs text-slate-400">
                  Free in {availability.busyHours.toFixed(1)}h
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div 
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Date Headers */}
        <div className="flex border-b" style={{ borderColor: '#334155' }}>
          <div className="w-40 flex-shrink-0 px-4 py-2 border-r" style={{ borderColor: '#334155' }}>
            <span className="text-sm font-medium text-slate-400">Printer</span>
          </div>
          <div className="flex-1 flex">
            {Array.from({ length: viewDays }).map((_, dayIndex) => {
              const dayDate = new Date(startDate);
              dayDate.setDate(dayDate.getDate() + dayIndex);
              const isToday = dayDate.toDateString() === new Date().toDateString();
              
              return (
                <div 
                  key={dayIndex}
                  className={`flex-1 text-center py-2 border-r ${isToday ? 'bg-cyan-500/10' : ''}`}
                  style={{ borderColor: '#334155' }}
                >
                  <p className={`text-sm font-medium ${isToday ? 'text-cyan-400' : 'text-white'}`}>
                    {formatDate(dayDate)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hour Headers */}
        <div className="flex border-b" style={{ borderColor: '#334155' }}>
          <div className="w-40 flex-shrink-0 border-r" style={{ borderColor: '#334155' }}></div>
          <div className="flex-1 flex">
            {Array.from({ length: viewDays }).map((_, dayIndex) => (
              <div key={dayIndex} className="flex-1 flex border-r" style={{ borderColor: '#334155' }}>
                {[0, 6, 12, 18].map(hour => (
                  <div 
                    key={hour}
                    className="flex-1 text-center py-1 text-xs text-slate-500 border-r"
                    style={{ borderColor: '#334155' }}
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Printer Rows */}
        {printers.map(printer => {
          const printerJobs = getJobsForPrinter(printer.name);
          
          return (
            <div 
              key={printer.name}
              className="flex border-b hover:bg-slate-800/30 transition"
              style={{ borderColor: '#334155' }}
            >
              {/* Printer Name */}
              <div 
                className="w-40 flex-shrink-0 px-4 py-3 border-r flex items-center gap-2"
                style={{ borderColor: '#334155' }}
              >
                <span>{getPrinterStatusIcon(printer.status)}</span>
                <span className="text-sm text-white truncate">{printer.name}</span>
              </div>

              {/* Timeline Bar */}
              <div className="flex-1 relative h-14">
                {/* Hour Grid Lines */}
                <div className="absolute inset-0 flex">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 border-r ${
                        slot.hour === 0 ? 'border-slate-600' : 'border-slate-700/50'
                      } ${slot.isWorkHour ? 'bg-slate-800/20' : ''}`}
                      style={{ borderColor: slot.hour === 0 ? '#475569' : '#334155' }}
                    />
                  ))}
                </div>

                {/* Now Indicator */}
                {(() => {
                  const now = new Date();
                  const timelineStart = new Date(startDate);
                  timelineStart.setHours(0, 0, 0, 0);
                  const totalMs = viewDays * 24 * 60 * 60 * 1000;
                  const nowMs = now.getTime() - timelineStart.getTime();
                  const nowPercent = (nowMs / totalMs) * 100;
                  
                  if (nowPercent >= 0 && nowPercent <= 100) {
                    return (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                        style={{ left: `${nowPercent}%` }}
                      >
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Jobs */}
                {printerJobs.map(job => {
                  const pos = getJobPosition(job);
                  if (!pos.visible) return null;
                  
                  const colors = getJobColor(job.status);
                  
                  return (
                    <div
                      key={job.id}
                      className={`absolute top-1 bottom-1 rounded-lg cursor-pointer transition-all z-10 ${colors.bg} opacity-80 hover:opacity-100`}
                      style={{
                        left: `${pos.left}%`,
                        width: `${pos.width}%`,
                        minWidth: '20px',
                      }}
                      onMouseEnter={() => setHoveredJob(job)}
                      onMouseLeave={() => setHoveredJob(null)}
                    >
                      <div className="px-2 py-1 h-full flex items-center overflow-hidden">
                        <span className="text-xs text-white font-medium truncate">
                          {job.name}
                        </span>
                      </div>
                      
                      {/* Progress Bar for Printing Jobs */}
                      {job.status === 'printing' && job.progress && (
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-white/50 rounded-b"
                          style={{ width: `${job.progress}%` }}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Click to schedule (empty slots) */}
                <div 
                  className="absolute inset-0 z-0 cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percent = x / rect.width;
                    const timelineStart = new Date(startDate);
                    timelineStart.setHours(0, 0, 0, 0);
                    const clickTime = new Date(timelineStart.getTime() + percent * viewDays * 24 * 60 * 60 * 1000);
                    
                    setSelectedSlot({
                      printer: printer.name,
                      time: clickTime,
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Job Tooltip */}
      {hoveredJob && (
        <div 
          className="fixed z-50 p-3 rounded-lg shadow-xl border max-w-xs pointer-events-none"
          style={{ 
            backgroundColor: '#1e293b', 
            borderColor: '#334155',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <p className="font-medium text-white mb-1">{hoveredJob.name}</p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Printer: {hoveredJob.printer || hoveredJob.printer_name}</p>
            <p>Duration: {hoveredJob.estimated_time_minutes}min</p>
            <p>Status: {hoveredJob.status}</p>
            {hoveredJob.progress && <p>Progress: {hoveredJob.progress}%</p>}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {selectedSlot && (
        <ScheduleSlotModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSchedule={(jobData) => {
            onScheduleJob?.(jobData);
            setSelectedSlot(null);
            loadData();
          }}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Printing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>Queued</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span>Paused</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-red-500"></div>
          <span>Now</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-800/50 border border-slate-700"></div>
          <span>Work Hours (8-20)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * ScheduleSlotModal - Quick schedule a job at a clicked time
 */
function ScheduleSlotModal({ slot, onClose, onSchedule }) {
  const [jobName, setJobName] = useState('');
  const [duration, setDuration] = useState(60);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!jobName.trim()) return;
    
    onSchedule({
      name: jobName,
      printer: slot.printer,
      scheduled_start: slot.time.toISOString(),
      estimated_time_minutes: duration,
      status: 'queued',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-sm rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <h3 className="font-bold text-white">Schedule Job</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500 mb-2">
              📍 {slot.printer} at {slot.time.toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Job Name</label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Enter job name..."
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Duration (minutes)</label>
            <div className="flex gap-2">
              {[30, 60, 120, 240].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDuration(mins)}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    duration === mins 
                      ? 'bg-cyan-500 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="10"
              max="1440"
              className="w-full px-3 py-2 rounded-lg text-white mt-2"
              style={{ backgroundColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!jobName.trim()}
              className="flex-1 py-2 rounded-lg font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}
            >
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CapacityTimeline;
