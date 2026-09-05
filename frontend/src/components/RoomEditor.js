import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Edit, Tv, Monitor, Square, Bed, GripVertical, X, MessageSquare } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEVICE_TYPES = {
  tv: { label: 'TV', icon: Tv, color: '#1a1a2e', defaultW: 30, defaultH: 24 },
  hello: { label: 'Hello', icon: Monitor, color: '#16a34a', defaultW: 9, defaultH: 6 },
  whiteboard: { label: 'Whiteboard', icon: Square, color: '#7c3aed', defaultW: 12, defaultH: 26 },
  roomsign: { label: 'Room Sign', icon: Square, color: '#ea580c', defaultW: 6, defaultH: 8 },
  bed: { label: 'Bed', icon: Bed, color: '#64748b', defaultW: 22, defaultH: 54 }
};

const STATUS_COLORS = {
  free: '#22c55e',
  inuse: '#eab308',
  not_available: '#ef4444'
};

const STATUS_LABELS = {
  free: 'Free',
  inuse: 'In Use',
  not_available: 'N/A'
};

export default function RoomEditor({ room, floorName, token, isAdmin, onClose, onUpdate }) {
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState(room.devices || []);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [notes, setNotes] = useState([]);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [newDevice, setNewDevice] = useState({ type: 'tv', label: '', sn: '' });
  const [roomName, setRoomName] = useState(room.name);
  const [newNote, setNewNote] = useState('');

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const SCALE = 6; // Scale factor for positioning

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedDevice || !isAdmin) return;
      
      const step = e.shiftKey ? 5 : 1;
      let newX = selectedDevice.x;
      let newY = selectedDevice.y;

      switch (e.key) {
        case 'ArrowUp': newY -= step; break;
        case 'ArrowDown': newY += step; break;
        case 'ArrowLeft': newX -= step; break;
        case 'ArrowRight': newX += step; break;
        case 'Delete':
          if (isAdmin) deleteDevice(selectedDevice.id);
          return;
        default: return;
      }

      e.preventDefault();
      updateDevicePosition(selectedDevice.id, newX, newY);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDevice, isAdmin]);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API}/tv/notes`, {
        params: { user_token: token, room_id: room.id }
      });
      setNotes(res.data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const updateDevicePosition = async (deviceId, newX, newY) => {
    // Clamp values
    newX = Math.max(0, Math.min(100 - (selectedDevice?.w || 10), newX));
    newY = Math.max(0, Math.min(100 - (selectedDevice?.h || 10), newY));

    try {
      await axios.put(`${API}/tv/rooms/${room.id}/devices/${deviceId}`, 
        { x: newX, y: newY },
        { params: { user_token: token } }
      );
      
      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, x: newX, y: newY } : d
      ));
      
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(prev => ({ ...prev, x: newX, y: newY }));
      }
    } catch (error) {
      toast.error('Error updating position');
    }
  };

  const updateDeviceStatus = async (deviceId, newStatus) => {
    try {
      await axios.put(`${API}/tv/rooms/${room.id}/devices/${deviceId}`,
        { status: newStatus },
        { params: { user_token: token } }
      );
      
      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, status: newStatus } : d
      ));
      
      if (selectedDevice?.id === deviceId) {
        setSelectedDevice(prev => ({ ...prev, status: newStatus }));
      }
      
      toast.success('Status updated');
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const addDevice = async () => {
    if (!newDevice.label.trim()) return;
    
    try {
      const typeInfo = DEVICE_TYPES[newDevice.type];
      const res = await axios.post(`${API}/tv/rooms/${room.id}/devices`, {
        ...newDevice,
        x: 50 - typeInfo.defaultW / 2,
        y: 50 - typeInfo.defaultH / 2,
        w: typeInfo.defaultW,
        h: typeInfo.defaultH
      }, { params: { user_token: token } });
      
      setDevices(res.data.devices);
      setShowAddDevice(false);
      setNewDevice({ type: 'tv', label: '', sn: '' });
      toast.success('Device added');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error adding device');
    }
  };

  const deleteDevice = async (deviceId) => {
    if (!window.confirm('Delete this device?')) return;
    
    try {
      await axios.delete(`${API}/tv/rooms/${room.id}/devices/${deviceId}`, {
        params: { user_token: token }
      });
      
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setSelectedDevice(null);
      toast.success('Device deleted');
      onUpdate();
    } catch (error) {
      toast.error('Error deleting device');
    }
  };

  const updateRoomName = async () => {
    if (!roomName.trim()) return;
    
    try {
      await axios.put(`${API}/tv/rooms/${room.id}`, 
        { name: roomName },
        { params: { user_token: token } }
      );
      toast.success('Room updated');
      setShowEditRoom(false);
      onUpdate();
    } catch (error) {
      toast.error('Error updating room');
    }
  };

  const deleteRoom = async () => {
    if (!window.confirm('Delete this room and all its devices?')) return;
    
    try {
      await axios.delete(`${API}/tv/rooms/${room.id}`, {
        params: { user_token: token }
      });
      toast.success('Room deleted');
      onUpdate();
      onClose();
    } catch (error) {
      toast.error('Error deleting room');
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await axios.post(`${API}/tv/notes`, {
        target_type: 'room',
        target_id: room.id,
        room_id: room.id,
        text: newNote
      }, { params: { user_token: token } });
      
      setNewNote('');
      fetchNotes();
      toast.success('Note added');
    } catch (error) {
      toast.error('Error adding note');
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(`${API}/tv/notes/${noteId}`, {
        params: { user_token: token }
      });
      fetchNotes();
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Error deleting note');
    }
  };

  // Mouse handlers for drag and drop
  const handleMouseDown = (e, device) => {
    if (!isAdmin) return;
    
    e.stopPropagation();
    setSelectedDevice(device);
    setIsDragging(true);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setDragOffset({
      x: mouseX - device.x,
      y: mouseY - device.y
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !selectedDevice || !isAdmin) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    
    let newX = mouseX - dragOffset.x;
    let newY = mouseY - dragOffset.y;
    
    // Clamp
    newX = Math.max(0, Math.min(100 - selectedDevice.w, newX));
    newY = Math.max(0, Math.min(100 - selectedDevice.h, newY));
    
    setDevices(prev => prev.map(d =>
      d.id === selectedDevice.id ? { ...d, x: newX, y: newY } : d
    ));
    setSelectedDevice(prev => ({ ...prev, x: newX, y: newY }));
  }, [isDragging, selectedDevice, dragOffset, isAdmin]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && selectedDevice) {
      updateDevicePosition(selectedDevice.id, selectedDevice.x, selectedDevice.y);
    }
    setIsDragging(false);
  }, [isDragging, selectedDevice]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Count devices by type
  const deviceCounts = devices.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {floorName}
              </Button>
              <span className="text-gray-400">›</span>
              <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
                {room.name}
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setShowEditRoom(true)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <Button variant="outline" onClick={() => setShowEditRoom(true)}>
                    Edit Room
                  </Button>
                  <Button variant="outline" className="text-red-500 hover:bg-red-50" onClick={deleteRoom}>
                    Delete Room
                  </Button>
                  <Button onClick={() => setShowAddDevice(true)} className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Device
                  </Button>
                </>
              )}
            </div>
          </div>
          {isAdmin && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Drag devices to reposition • Use arrow keys for fine movement • Click for info
            </p>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Canvas Area */}
          <div className="flex-1">
            <div 
              ref={canvasRef}
              className="relative bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden"
              style={{ 
                width: '100%', 
                paddingBottom: '75%', // 4:3 aspect ratio
                cursor: isDragging ? 'grabbing' : 'default'
              }}
              onClick={() => setSelectedDevice(null)}
            >
              <div className="absolute inset-0">
                {/* Grid lines */}
                <svg className="absolute inset-0 w-full h-full opacity-10">
                  <defs>
                    <pattern id="grid" width="10%" height="10%" patternUnits="userSpaceOnUse">
                      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Devices */}
                {devices.map(device => {
                  const typeInfo = DEVICE_TYPES[device.type] || DEVICE_TYPES.tv;
                  const isSelected = selectedDevice?.id === device.id;
                  const statusColor = STATUS_COLORS[device.status || 'free'];

                  return (
                    <div
                      key={device.id}
                      className={`absolute transition-shadow ${isAdmin ? 'cursor-grab' : 'cursor-pointer'} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                      style={{
                        left: `${device.x}%`,
                        top: `${device.y}%`,
                        width: `${device.w}%`,
                        height: `${device.h}%`,
                        backgroundColor: typeInfo.color,
                        borderRadius: device.type === 'hello' ? '50%' : '4px',
                        border: `3px solid ${statusColor}`,
                        boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: isSelected ? 100 : 10,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, device)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDevice(device);
                      }}
                    >
                      {/* Status indicator */}
                      <div 
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                        style={{ backgroundColor: statusColor }}
                      />
                      
                      {/* Label */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xs font-bold text-center px-1 truncate" style={{ fontSize: '0.6rem' }}>
                          {device.label}
                        </span>
                      </div>

                      {/* Delete button on hover (admin only) */}
                      {isAdmin && isSelected && (
                        <button
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 z-20"
                          onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {devices.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <p>No devices in this room. {isAdmin && 'Click "Add Device" to add one.'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 space-y-4">
            {/* Room Info */}
            <Card className="dark:bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wide text-gray-500">Room Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Total Devices</span>
                  <span className="font-bold">{devices.length}</span>
                </div>
                {Object.entries(deviceCounts).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 uppercase">{type}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Device Status List */}
            <Card className="dark:bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wide text-gray-500">Device Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {devices.map(device => {
                  const typeInfo = DEVICE_TYPES[device.type] || DEVICE_TYPES.tv;
                  const isSelected = selectedDevice?.id === device.id;
                  
                  return (
                    <div 
                      key={device.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm dark:text-white">{device.label}</p>
                          <p className="text-xs text-gray-500">{typeInfo.label} • {device.sn || 'No SN'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[device.status || 'free'] }}
                          />
                          <span className="text-xs font-medium">{STATUS_LABELS[device.status || 'free']}</span>
                        </div>
                      </div>
                      
                      {/* Quick status change buttons */}
                      <div className="flex gap-1 mt-2">
                        {['free', 'inuse', 'not_available'].map(status => (
                          <button
                            key={status}
                            className={`px-2 py-0.5 text-xs rounded ${device.status === status ? 'opacity-50' : 'hover:opacity-80'}`}
                            style={{ 
                              backgroundColor: STATUS_COLORS[status] + '20', 
                              color: STATUS_COLORS[status],
                              border: `1px solid ${STATUS_COLORS[status]}`
                            }}
                            disabled={device.status === status}
                            onClick={(e) => { e.stopPropagation(); updateDeviceStatus(device.id, status); }}
                          >
                            {STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {devices.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No devices</p>
                )}
              </CardContent>
            </Card>

            {/* Room Notes */}
            <Card className="dark:bg-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wide text-gray-500 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Room Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {notes.map(note => (
                    <div key={note.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded text-sm">
                      <p className="dark:text-white">{note.text}</p>
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                        <span>{note.author_name}</span>
                        <button 
                          onClick={() => deleteNote(note.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No notes</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="text-sm dark:bg-slate-700"
                    onKeyDown={(e) => e.key === 'Enter' && addNote()}
                  />
                  <Button size="sm" onClick={addNote}>Add</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Device Dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent className="dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle>Add Device to {room.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Device Type</Label>
              <Select value={newDevice.type} onValueChange={v => setNewDevice({...newDevice, type: v})}>
                <SelectTrigger className="dark:bg-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-700">
                  {Object.entries(DEVICE_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input 
                value={newDevice.label}
                onChange={e => setNewDevice({...newDevice, label: e.target.value})}
                placeholder="e.g., TV 1, Hello 2"
                className="dark:bg-slate-700"
              />
            </div>
            <div>
              <Label>Serial Number (optional)</Label>
              <Input 
                value={newDevice.sn}
                onChange={e => setNewDevice({...newDevice, sn: e.target.value})}
                placeholder="e.g., SN-TV10001"
                className="dark:bg-slate-700"
              />
            </div>
            <Button onClick={addDevice} className="w-full">Add Device</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={showEditRoom} onOpenChange={setShowEditRoom}>
        <DialogContent className="dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Name</Label>
              <Input 
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                className="dark:bg-slate-700"
              />
            </div>
            <Button onClick={updateRoomName} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
