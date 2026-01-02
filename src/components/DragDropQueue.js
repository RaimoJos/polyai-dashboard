import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

/**
 * Drag & Drop Print Queue Manager
 */
function DragDropQueue() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await api.getJobQueue();
      const allJobs = res.data?.data?.jobs || res.data?.jobs || [];
      // Only show queued jobs (not completed/failed)
      const queuedJobs = allJobs.filter(j => 
        ['queued', 'assigned'].includes(j.status)
      );
      setJobs(queuedJobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === index) return;
    setDragOverItem(index);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === dropIndex) return;

    const newJobs = [...jobs];
    const [draggedJob] = newJobs.splice(draggedItem, 1);
    newJobs.splice(dropIndex, 0, draggedJob);
    
    setJobs(newJobs);
    setDraggedItem(null);
    setDragOverItem(null);

    // Save new order to backend
    await saveOrder(newJobs);
  };

  const saveOrder = async (orderedJobs) => {
    setSaving(true);
    try {
      // Update priority based on position
      for (let i = 0; i < orderedJobs.length; i++) {
        const job = orderedJobs[i];
        const newPriority = orderedJobs.length - i; // Higher number = higher priority
        
        await api.updateJob(job.job_id, { 
          queue_position: i,
          // Could also update priority here
        });
      }
    } catch (err) {
      console.error('Failed to save order:', err);
      // Refresh to get actual state
      fetchJobs();
    } finally {
      setSaving(false);
    }
  };

  const moveUp = async (index) => {
    if (index === 0) return;
    const newJobs = [...jobs];
    [newJobs[index - 1], newJobs[index]] = [newJobs[index], newJobs[index - 1]];
    setJobs(newJobs);
    await saveOrder(newJobs);
  };

  const moveDown = async (index) => {
    if (index === jobs.length - 1) return;
    const newJobs = [...jobs];
    [newJobs[index], newJobs[index + 1]] = [newJobs[index + 1], newJobs[index]];
    setJobs(newJobs);
    await saveOrder(newJobs);
  };

  const moveToTop = async (index) => {
    if (index === 0) return;
    const newJobs = [...jobs];
    const [job] = newJobs.splice(index, 1);
    newJobs.unshift(job);
    setJobs(newJobs);
    await saveOrder(newJobs);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'NORMAL': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LOW': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '--';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading queue...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">📋 Print Queue</h2>
          <p className="text-sm text-gray-500">Drag to reorder • {jobs.length} jobs</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-sm text-blue-500 flex items-center gap-1">
              <span className="animate-spin">⏳</span> Saving...
            </span>
          )}
          <button
            onClick={fetchJobs}
            className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-500">Queue is empty</p>
        </div>
      ) : (
        <div className="divide-y">
          {jobs.map((job, index) => (
            <div
              key={job.job_id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={`p-4 flex items-center gap-4 cursor-move transition-all ${
                dragOverItem === index ? 'bg-blue-50 border-t-2 border-blue-500' : ''
              } ${draggedItem === index ? 'opacity-50' : ''} hover:bg-gray-50`}
            >
              {/* Position & Drag Handle */}
              <div className="flex flex-col items-center text-gray-400 w-8">
                <span className="text-lg font-bold text-gray-300">#{index + 1}</span>
                <span className="text-xs">⋮⋮</span>
              </div>

              {/* Job Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">
                    {job.file_path || job.filename || 'Unknown'}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${getPriorityColor(job.priority)}`}>
                    {job.priority || 'NORMAL'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  {job.assigned_printer && (
                    <span>🖨️ {job.assigned_printer}</span>
                  )}
                  {job.filament_type && (
                    <span>🧵 {job.filament_type}</span>
                  )}
                  <span>⏱️ {formatDuration(job.estimated_time_minutes)}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveToTop(index)}
                  disabled={index === 0}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move to top"
                >
                  ⏫
                </button>
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  ⬆️
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === jobs.length - 1}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  ⬇️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="p-4 border-t bg-gray-50 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-200"></span> Urgent
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-200"></span> High
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-200"></span> Normal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-200"></span> Low
        </span>
      </div>
    </div>
  );
}

export default DragDropQueue;
