import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Upload } from 'lucide-react';

const AdminPanel = ({ isOpen, onClose, onAddChannel }) => {
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    description: '',
    logo: ''
  });
  const [logoPreview, setLogoPreview] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setFormData(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.number) {
      onAddChannel({
        ...formData,
        logo: formData.logo || `https://via.placeholder.com/200x120/0056A8/ffffff?text=CH+${formData.number}`
      });
      // Reset form
      setFormData({ name: '', number: '', description: '', logo: '' });
      setLogoPreview('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Add New Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white text-base">Channel Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Premium Movies HD"
              required
              className="bg-[#2a2a2a] border-gray-600 text-white text-base h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="number" className="text-white text-base">Channel Number *</Label>
            <Input
              id="number"
              name="number"
              value={formData.number}
              onChange={handleInputChange}
              placeholder="e.g., 1305"
              required
              className="bg-[#2a2a2a] border-gray-600 text-white text-base h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white text-base">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the channel"
              className="bg-[#2a2a2a] border-gray-600 text-white text-base min-h-24"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo" className="text-white text-base">Channel Logo</Label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="logo"
                className="flex items-center gap-2 px-4 py-3 bg-[#0056A8] hover:bg-[#0066c8] text-white rounded-lg cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>Upload Logo</span>
              </label>
              <input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {logoPreview && (
                <div className="w-32 h-20 rounded-lg overflow-hidden border-2 border-gray-600">
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#0056A8] hover:bg-[#0066c8] text-white"
            >
              Add Channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
