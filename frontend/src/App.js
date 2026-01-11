import { useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ChannelFeatured from "./components/ChannelFeatured";
import EPGGrid from "./components/EPGGrid";
import AdminPanel from "./components/AdminPanel";
import { mockChannels, mockPrograms, timeSlots } from "./mock";

const GuideView = () => {
  const [channels, setChannels] = useState(mockChannels);
  const [selectedChannel, setSelectedChannel] = useState(mockChannels[2]); // Default to channel 3
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const handleAddChannel = (newChannel) => {
    const channel = {
      ...newChannel,
      id: (channels.length + 1).toString()
    };
    setChannels([...channels, channel]);
  };

  const handleChannelSelect = (channel) => {
    setSelectedChannel(channel);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <TopBar onAddChannel={() => setIsAdminOpen(true)} />
      
      <div className="pt-20 pl-24 px-8 py-8">
        <ChannelFeatured channel={selectedChannel} />
        <EPGGrid
          channels={channels}
          programs={mockPrograms}
          timeSlots={timeSlots}
          selectedChannelId={selectedChannel?.id}
          onChannelSelect={handleChannelSelect}
        />
      </div>

      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onAddChannel={handleAddChannel}
      />
    </div>
  );
};

const Home = () => {
  const [activeView, setActiveView] = useState('guide');

  return (
    <div className="relative">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      {activeView === 'guide' ? (
        <GuideView />
      ) : (
        <div className="pl-24 pt-20 min-h-screen bg-[#1a1a1a] flex items-center justify-center">
          <p className="text-white text-2xl">
            {activeView.charAt(0).toUpperCase() + activeView.slice(1)} View - Coming Soon
          </p>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
