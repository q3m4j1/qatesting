import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import RoomEditor from '@/components/RoomEditor';
import { ArrowLeft, Plus, Tv, Monitor, Bed, Square, MessageSquare, Activity, Settings, Trash2, Edit } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEVICE_TYPES = {
  tv: { label: 'TV', icon: Tv, color: 'bg-blue-500' },
  hello: { label: 'Hello Device', icon: Monitor, color: 'bg-green-500' },
  whiteboard: { label: 'Whiteboard', icon: Square, color: 'bg-purple-500' },
  roomsign: { label: 'Room Sign', icon: Square, color: 'bg-orange-500' },
  bed: { label: 'Bed', icon: Bed, color: 'bg-gray-500' }
};

const STATUS_COLORS = {
  free: 'bg-green-100 border-green-500 text-green-700',
  inuse: 'bg-yellow-100 border-yellow-500 text-yellow-700',
  not_available: 'bg-red-100 border-red-500 text-red-700'
};

const STATUS_LABELS = {
  free: 'Free to Use',
  inuse: 'In Use',
  not_available: 'Not Available'
};

export default function TVSetups({ user, token }) {
  const navigate = useNavigate();
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null); // For RoomEditor
  
  // Form data
  const [newFloorName, setNewFloorName] = useState('');
  const [newRoom, setNewRoom] = useState({ name: '', side: 'left', pos: 1 });
  const [newDevice, setNewDevice] = useState({ type: 'tv', label: '', sn: '' });

  const isAdmin = user?.role === 'Admin';

  // Get floor name for editor
  const getFloorName = (floorId) => {
    const floor = floors.find(f => f.id === floorId);
    return floor?.name || 'Floor';
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [floorsRes, roomsRes] = await Promise.all([
        axios.get(`${API}/tv/floors`, { params: { user_token: token } }),
        axios.get(`${API}/tv/rooms`, { params: { user_token: token } })
      ]);
      
      setFloors(floorsRes.data);
      setRooms(roomsRes.data);
      
      if (floorsRes.data.length > 0 && !selectedFloor) {
        setSelectedFloor(floorsRes.data[0].id);
      }
      
      // If no data exists and user is admin, initialize defaults
      if (floorsRes.data.length === 0 && isAdmin) {
        await initDefaults();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const initDefaults = async () => {
    try {
      await axios.post(`${API}/tv/init-defaults`, {}, { params: { user_token: token } });
      toast.success('Default rooms and devices created');
      await fetchData();
    } catch (error) {
      console.error('Error initializing defaults:', error);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get(`${API}/tv/activity`, { params: { user_token: token } });
      setActivity(res.data);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  // Floor operations
  const createFloor = async () => {
    if (!newFloorName.trim()) return;
    try {
      await axios.post(`${API}/tv/floors`, { name: newFloorName }, { params: { user_token: token } });
      toast.success('Floor created');
      setNewFloorName('');
      setFloorDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating floor');
    }
  };

  const deleteFloor = async (floorId) => {
    if (!window.confirm('Delete this floor and all its rooms?')) return;
    try {
      await axios.delete(`${API}/tv/floors/${floorId}`, { params: { user_token: token } });
      toast.success('Floor deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting floor');
    }
  };

  // Room operations
  const createRoom = async () => {
    if (!newRoom.name.trim() || !selectedFloor) return;
    try {
      await axios.post(`${API}/tv/rooms`, { ...newRoom, floor_id: selectedFloor }, { params: { user_token: token } });
      toast.success('Room created');
      setNewRoom({ name: '', side: 'left', pos: 1 });
      setRoomDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating room');
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room and all its devices?')) return;
    try {
      await axios.delete(`${API}/tv/rooms/${roomId}`, { params: { user_token: token } });
      toast.success('Room deleted');
      setSelectedRoom(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting room');
    }
  };

  // Device operations
  const addDevice = async () => {
    if (!newDevice.label.trim() || !selectedRoom) return;
    try {
      await axios.post(`${API}/tv/rooms/${selectedRoom.id}/devices`, newDevice, { params: { user_token: token } });
      toast.success('Device added');
      setNewDevice({ type: 'tv', label: '', sn: '' });
      setDeviceDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error adding device');
    }
  };

  const updateDeviceStatus = async (roomId, deviceId, newStatus) => {
    try {
      await axios.put(`${API}/tv/rooms/${roomId}/devices/${deviceId}`, { status: newStatus }, { params: { user_token: token } });
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating status');
    }
  };

  const deleteDevice = async (roomId, deviceId) => {
    if (!window.confirm('Delete this device?')) return;
    try {
      await axios.delete(`${API}/tv/rooms/${roomId}/devices/${deviceId}`, { params: { user_token: token } });
      toast.success('Device deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error deleting device');
    }
  };

  const filteredRooms = rooms.filter(r => r.floor_id === selectedFloor);
  const leftRooms = filteredRooms.filter(r => r.side === 'left').sort((a, b) => a.pos - b.pos);
  const rightRooms = filteredRooms.filter(r => r.side === 'right').sort((a, b) => a.pos - b.pos);

  const getRoomStatusSummary = (room) => {
    const devices = room.devices || [];
    const counts = { free: 0, inuse: 0, not_available: 0 };
    devices.forEach(d => counts[d.status || 'free']++);
    return counts;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading TV Setups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/home')}
                className="flex items-center gap-2"
                data-testid="back-to-home"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Hub</span>
              </Button>
              <img src="/hellocare-logo.png" alt="HelloCare" className="h-10" />
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">TV Setups</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isAdmin ? 'Admin View' : 'User View'} • {user?.first_name} {user?.last_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { fetchActivity(); setActivityDialogOpen(true); }}
              >
                <Activity className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Activity</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Floor Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {floors.map(floor => (
            <Button
              key={floor.id}
              variant={selectedFloor === floor.id ? 'default' : 'outline'}
              onClick={() => { setSelectedFloor(floor.id); setSelectedRoom(null); }}
              className="flex items-center gap-2"
            >
              {floor.name}
              {isAdmin && (
                <Trash2 
                  className="w-3 h-3 ml-1 hover:text-red-500" 
                  onClick={(e) => { e.stopPropagation(); deleteFloor(floor.id); }}
                />
              )}
            </Button>
          ))}
          {isAdmin && (
            <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Add Floor
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-slate-800">
                <DialogHeader>
                  <DialogTitle>Add New Floor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Floor Name</Label>
                    <Input 
                      value={newFloorName} 
                      onChange={e => setNewFloorName(e.target.value)}
                      placeholder="e.g., Floor 3 - Corridor C"
                      className="dark:bg-slate-700"
                    />
                  </div>
                  <Button onClick={createFloor} className="w-full">Create Floor</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Corridor View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side Rooms */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Left Side</h3>
            {leftRooms.map(room => (
              <RoomCard 
                key={room.id} 
                room={room} 
                isAdmin={isAdmin}
                isSelected={selectedRoom?.id === room.id}
                onSelect={() => setSelectedRoom(room)}
                onDoubleClick={() => setEditingRoom(room)}
                onDelete={() => deleteRoom(room.id)}
                onStatusChange={updateDeviceStatus}
                onDeleteDevice={deleteDevice}
                getRoomStatusSummary={getRoomStatusSummary}
              />
            ))}
            {leftRooms.length === 0 && (
              <p className="text-gray-400 text-sm italic">No rooms on left side</p>
            )}
          </div>

          {/* Right Side Rooms */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Right Side</h3>
            {rightRooms.map(room => (
              <RoomCard 
                key={room.id} 
                room={room} 
                isAdmin={isAdmin}
                isSelected={selectedRoom?.id === room.id}
                onSelect={() => setSelectedRoom(room)}
                onDoubleClick={() => setEditingRoom(room)}
                onDelete={() => deleteRoom(room.id)}
                onStatusChange={updateDeviceStatus}
                onDeleteDevice={deleteDevice}
                getRoomStatusSummary={getRoomStatusSummary}
              />
            ))}
            {rightRooms.length === 0 && (
              <p className="text-gray-400 text-sm italic">No rooms on right side</p>
            )}
          </div>
        </div>

        {/* Add Room Button (Admin) */}
        {isAdmin && selectedFloor && (
          <div className="mt-6">
            <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500">
                  <Plus className="w-4 h-4 mr-2" /> Add Room
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-slate-800">
                <DialogHeader>
                  <DialogTitle>Add New Room</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Room Name</Label>
                    <Input 
                      value={newRoom.name} 
                      onChange={e => setNewRoom({...newRoom, name: e.target.value})}
                      placeholder="e.g., Dhoma 5"
                      className="dark:bg-slate-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Side</Label>
                      <Select value={newRoom.side} onValueChange={v => setNewRoom({...newRoom, side: v})}>
                        <SelectTrigger className="dark:bg-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-700">
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Position</Label>
                      <Input 
                        type="number" 
                        min="1"
                        value={newRoom.pos} 
                        onChange={e => setNewRoom({...newRoom, pos: parseInt(e.target.value) || 1})}
                        className="dark:bg-slate-700"
                      />
                    </div>
                  </div>
                  <Button onClick={createRoom} className="w-full">Create Room</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Add Device Button (Admin) - shown when room is selected */}
        {isAdmin && selectedRoom && (
          <div className="fixed bottom-6 right-6">
            <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg rounded-full px-6">
                  <Plus className="w-5 h-5 mr-2" /> Add Device to {selectedRoom.name}
                </Button>
              </DialogTrigger>
              <DialogContent className="dark:bg-slate-800">
                <DialogHeader>
                  <DialogTitle>Add Device to {selectedRoom.name}</DialogTitle>
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
          </div>
        )}
      </div>

      {/* Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="dark:bg-slate-800 max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent Activity (Last 12 hours)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activity.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No recent activity</p>
            ) : (
              activity.map((a, i) => (
                <div key={i} className="p-2 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                  <p className="font-medium">{a.user_name}</p>
                  <p className="text-gray-600 dark:text-gray-300">{a.message}</p>
                  <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Editor - Full Screen */}
      {editingRoom && (
        <RoomEditor
          room={editingRoom}
          floorName={getFloorName(editingRoom.floor_id)}
          token={token}
          isAdmin={isAdmin}
          onClose={() => setEditingRoom(null)}
          onUpdate={() => {
            fetchData();
            // Update the editing room with fresh data
            const updatedRoom = rooms.find(r => r.id === editingRoom.id);
            if (updatedRoom) setEditingRoom(updatedRoom);
          }}
        />
      )}
    </div>
  );
}

// Room Card Component
function RoomCard({ room, isAdmin, isSelected, onSelect, onDoubleClick, onDelete, onStatusChange, onDeleteDevice, getRoomStatusSummary }) {
  const statusSummary = getRoomStatusSummary(room);
  const devices = room.devices || [];
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-purple-500 shadow-lg' : 'hover:shadow-md'} dark:bg-slate-800`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {room.name}
            <span className="text-xs text-gray-400 font-normal">(double-click to edit)</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Status Summary Badges */}
            {statusSummary.free > 0 && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                {statusSummary.free} free
              </span>
            )}
            {statusSummary.inuse > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                {statusSummary.inuse} in use
              </span>
            )}
            {statusSummary.not_available > 0 && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                {statusSummary.not_available} n/a
              </span>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {isSelected && (
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {devices.map(device => {
              const typeInfo = DEVICE_TYPES[device.type] || DEVICE_TYPES.tv;
              const Icon = typeInfo.icon;
              const statusClass = STATUS_COLORS[device.status || 'free'];
              
              return (
                <div 
                  key={device.id}
                  className={`p-3 rounded-lg border-2 ${statusClass} relative group`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{device.label}</span>
                  </div>
                  {device.sn && (
                    <p className="text-xs opacity-70">{device.sn}</p>
                  )}
                  <p className="text-xs font-semibold mt-1">{STATUS_LABELS[device.status || 'free']}</p>
                  
                  {/* Status Change Buttons */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {['free', 'inuse', 'not_available'].map(status => (
                      <button
                        key={status}
                        onClick={(e) => { e.stopPropagation(); onStatusChange(room.id, device.id, status); }}
                        className={`px-2 py-0.5 text-xs rounded ${device.status === status ? 'opacity-50' : 'opacity-80 hover:opacity-100'} ${STATUS_COLORS[status]}`}
                        disabled={device.status === status}
                      >
                        {STATUS_LABELS[status].split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  
                  {/* Delete Button (Admin) */}
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteDevice(room.id, device.id); }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-red-500 text-white rounded-full"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {devices.length === 0 && (
            <p className="text-gray-400 text-sm italic text-center py-4">No devices in this room</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
