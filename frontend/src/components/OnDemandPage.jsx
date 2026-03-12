import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Star, Filter } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = ['all', 'movie', 'tv_show', 'mini_series', 'limited_series'];
const catLabels = { all: 'All', movie: 'Movies', tv_show: 'TV Shows', mini_series: 'Mini Series', limited_series: 'Limited Series' };
const catColors = { movie: '#1d4ed8', tv_show: '#16a34a', mini_series: '#7c3aed', limited_series: '#dc2626' };

const OnDemandPage = ({ onBack }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [playingItem, setPlayingItem] = useState(null);

  useEffect(() => {
    const fetchVOD = async () => {
      setLoading(true);
      try {
        const params = category !== 'all' ? { category } : {};
        const res = await axios.get(`${API}/vod`, { params });
        setItems(res.data);
      } catch (e) {
        console.error('Failed to load VOD', e);
      } finally {
        setLoading(false);
      }
    };
    fetchVOD();
  }, [category]);

  const featured = items.filter(i => i.is_featured);
  const regular = items.filter(i => !i.is_featured);

  if (playingItem) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black/80">
          <h2 className="text-white text-xl font-semibold">{playingItem.title}</h2>
          <button onClick={() => setPlayingItem(null)} className="text-white text-2xl hover:text-gray-300 px-4">✕</button>
        </div>
        <div className="flex-1 flex items-center justify-center bg-black">
          {playingItem.media_file_path ? (
            <video
              controls
              autoPlay
              className="max-w-full max-h-full"
              src={`${BACKEND_URL}${playingItem.media_file_path}`}
            />
          ) : (
            <div className="text-center text-gray-400">
              <Play className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-xl">No video file linked to this title</p>
              <p className="text-sm mt-2 opacity-60">Assign a media file from the admin Media Library</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#1a1a1a] text-white" data-testid="on-demand-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1a1a1a]/95 backdrop-blur px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-light">On Demand</h1>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm flex items-center gap-2">
            ← Back to Guide
          </button>
        </div>
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${category === cat ? 'bg-[#0056A8] text-white' : 'bg-[#2a2a2a] text-gray-400 hover:text-white'}`}>
              {catLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#0056A8]" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-xl mb-2">No content available</p>
            <p className="text-gray-600 text-sm">Check back soon for new titles</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <section>
                <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Featured
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {featured.map(item => <VODCard key={item.id} item={item} onPlay={() => setPlayingItem(item)} />)}
                </div>
              </section>
            )}
            {/* Regular */}
            {regular.length > 0 && (
              <section>
                {featured.length > 0 && <h2 className="text-xl font-medium text-white mb-4">More Titles</h2>}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {regular.map(item => <VODCard key={item.id} item={item} onPlay={() => setPlayingItem(item)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const VODCard = ({ item, onPlay }) => (
  <div className="group cursor-pointer" onClick={onPlay} data-testid={`vod-card-${item.id}`}>
    <div className="aspect-[2/3] bg-[#2a2a2a] rounded-lg overflow-hidden relative mb-2">
      {item.poster_path ? (
        <img src={`${BACKEND_URL}${item.poster_path}`} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0056A8] to-[#003d7a]">
          <Play className="w-12 h-12 text-white opacity-60" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-7 h-7 text-white ml-1" />
        </div>
      </div>
      {item.category && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs text-white font-medium"
          style={{ backgroundColor: catColors[item.category] || '#555' }}>
          {catLabels[item.category] || item.category}
        </div>
      )}
    </div>
    <h3 className="text-white text-sm font-medium truncate">{item.title}</h3>
    <p className="text-gray-500 text-xs">{item.duration_formatted || (item.year ? String(item.year) : '')}</p>
  </div>
);

export default OnDemandPage;
