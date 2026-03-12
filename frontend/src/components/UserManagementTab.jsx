import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Trash2, Edit, Eye, Plus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UserManagementTab = ({ token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false);
  const [selectedUserDevices, setSelectedUserDevices] = useState(null);
  
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    max_devices: 3,
    account_status: 'active'
  });

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, { headers: getHeaders() });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    try {
      if (isEditMode && editingUserId) {
        // Update user
        const updateData = { ...userForm };
        delete updateData.password; // Don't update password in edit mode
        
        await axios.put(`${API}/users/${editingUserId}`, updateData, { headers: getHeaders() });
        toast.success('User updated successfully');
      } else {
        // Create new user
        await axios.post(`${API}/users`, userForm, { headers: getHeaders() });
        toast.success('User created successfully');
      }
      
      setIsUserDialogOpen(false);
      setIsEditMode(false);
      setEditingUserId(null);
      setUserForm({ username: '', email: '', password: '', full_name: '', max_devices: 3 });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleEditUser = (user) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      max_devices: user.max_devices || 3
    });
    setIsUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`${API}/users/${userId}`, { headers: getHeaders() });
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleViewDevices = async (userId, username) => {
    try {
      const response = await axios.get(`${API}/users/${userId}/devices`, { headers: getHeaders() });
      setSelectedUserDevices({ username, ...response.data });
      setIsDevicesDialogOpen(true);
    } catch (error) {
      toast.error('Failed to fetch user devices');
    }
  };

  const handleAddNewUser = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setUserForm({ username: '', email: '', password: '', full_name: '', max_devices: 3, account_status: 'active' });
    setIsUserDialogOpen(true);
  };

  const getAccountStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'suspended':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'trial':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-white">User Management</h2>
        <Button
          onClick={handleAddNewUser}
          className="bg-[#0056A8] hover:bg-[#0066c8]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className="text-left p-3 text-gray-300">Username</th>
                  <th className="text-left p-3 text-gray-300">Email</th>
                  <th className="text-left p-3 text-gray-300">Full Name</th>
                  <th className="text-left p-3 text-gray-300">Account Status</th>
                  <th className="text-left p-3 text-gray-300">Max Devices</th>
                  <th className="text-left p-3 text-gray-300">Active</th>
                  <th className="text-right p-3 text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-gray-700">
                    <td className="p-3 text-white font-medium">{user.username}</td>
                    <td className="p-3 text-gray-400">{user.email}</td>
                    <td className="p-3 text-gray-400">{user.full_name || '-'}</td>
                    <td className="p-3">
                      <Badge className={getSubscriptionColor(user.subscription_status)}>
                        {user.subscription_status}
                      </Badge>
                    </td>
                    <td className="p-3 text-gray-400">{user.max_devices}</td>
                    <td className="p-3">
                      <Badge className={user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDevices(user.id, user.username)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              {isEditMode ? 'Edit User' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">Username *</Label>
              <Input
                id="username"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="username"
                required
                disabled={isEditMode}
                className="bg-[#2a2a2a] border-gray-600 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email *</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@example.com"
                required
                className="bg-[#2a2a2a] border-gray-600 text-white"
              />
            </div>
            
            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                  required={!isEditMode}
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-white">Full Name</Label>
              <Input
                id="full_name"
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                placeholder="John Doe"
                className="bg-[#2a2a2a] border-gray-600 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max_devices" className="text-white">Max Devices</Label>
              <Input
                id="max_devices"
                type="number"
                min="1"
                max="10"
                value={userForm.max_devices}
                onChange={(e) => setUserForm({ ...userForm, max_devices: parseInt(e.target.value) })}
                className="bg-[#2a2a2a] border-gray-600 text-white"
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setIsUserDialogOpen(false)}
                className="bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0056A8] hover:bg-[#0066c8]">
                {isEditMode ? 'Update User' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Devices Dialog */}
      <Dialog open={isDevicesDialogOpen} onOpenChange={setIsDevicesDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              Devices for {selectedUserDevices?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedUserDevices?.devices?.length > 0 ? (
              <div className="space-y-3">
                {selectedUserDevices.devices.map((device) => (
                  <Card key={device.id} className="bg-[#2a2a2a] border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{device.device_name}</p>
                          <p className="text-sm text-gray-400">MAC: {device.mac_address}</p>
                          <p className="text-xs text-gray-500">Status: {device.status}</p>
                        </div>
                        <Badge className={device.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                          {device.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No devices assigned to this user</p>
            )}
            <div className="mt-4 p-3 bg-[#2a2a2a] rounded">
              <p className="text-sm text-gray-400">
                Device Limit: {selectedUserDevices?.device_count || 0} / {selectedUserDevices?.max_devices || 0}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementTab;
