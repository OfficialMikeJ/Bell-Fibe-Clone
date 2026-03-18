import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Tv, Zap, RefreshCw, ChevronRight, Clock, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SECTION_COLORS = {
  app_update:       { bg: 'from-blue-900/40 to-transparent',   border: 'border-blue-700/40',   badge: 'bg-blue-700',      icon: <Zap className="w-4 h-4" /> },
  upcoming_feature: { bg: 'from-purple-900/40 to-transparent', border: 'border-purple-700/40', badge: 'bg-purple-700',    icon: <Star className="w-4 h-4" /> },
};

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── VOD Poster Card ────────────────────────────────────────────────────────────
const VODCard = ({ item, onClick }) => {
  const posterUrl = item.poster_path
    ? `${API}/api${item.poster_path}`
    : null;

  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-36 cursor-pointer group"
      data-testid={`home-vod-card-${item.id}`}
    >
      <div className="w-36 h-52 rounded-xl overflow-hidden bg-[#2a2a2a] border border-gray-700 group-hover:border-[#0056A8] transition-all duration-200 relative shadow-lg">
        {posterUrl ? (
          <img src={posterUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#2a2a3e]">
            <Tv className="w-10 h-10 text-gray-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
          <div className="flex items-center gap-1.5 bg-[#0056A8] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Play className="w-3 h-3" /> Watch
          </div>
        </div>
        {item.is_featured && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">
            FEATURED
          </div>
        )}
      </div>
      <p className="text-white text-xs font-medium mt-2 truncate px-0.5">{item.title}</p>
      {item.release_year && <p className="text-gray-500 text-xs px-0.5">{item.release_year}</p>}
    </div>
  );
};

// ── Announcement Post Card ─────────────────────────────────────────────────────
const PostCard = ({ post }) => {
  const style = SECTION_COLORS[post.category] || SECTION_COLORS.app_update;
  return (
    <div
      className={`bg-gradient-to-r ${style.bg} border ${style.border} rounded-xl p-5`}
      data-testid={`home-post-${post.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 ${style.badge} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
              {style.icon}
              {post.category === 'app_update' ? 'App Update' : 'Upcoming Feature'}
            </span>
            {post.version_tag && (
              <span className="text-gray-400 text-xs bg-gray-800 px-2 py-0.5 rounded-full font-mono">{post.version_tag}</span>
            )}
          </div>
          <h3 className="text-white font-semibold text-base mb-1.5">{post.title}</h3>
          <p className="text-gray-300 text-sm leading-relaxed">{post.body}</p>
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-xs flex-shrink-0 mt-1">
          <Clock className="w-3 h-3" />
          {timeAgo(post.created_at)}
        </div>
      </div>
    </div>
  );
};

// ── Section Wrapper ────────────────────────────────────────────────────────────
const Section = ({ title, icon, children, action }) => (
  <div className="mb-10">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-6 bg-[#0056A8] rounded-full" />
        <h2 className="text-white text-xl font-semibold flex items-center gap-2">
          {icon} {title}
        </h2>
      </div>
      {action}
    </div>
    {children}
  </div>
);

// ── Empty State ────────────────────────────────────────────────────────────────
const Empty = ({ message }) => (
  <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl px-6 py-8 text-center">
    <p className="text-gray-500 text-sm">{message}</p>
  </div>
);

// ── Main HomePage ──────────────────────────────────────────────────────────────
const HomePage = ({ onViewChange }) => {
  const [movies,   setMovies]   = useState([]);
  const [shows,    setShows]    = useState([]);
  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [movRes, showRes, postRes] = await Promise.all([
          axios.get(`${API}/api/vod`, { params: { category: 'movie' } }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/vod`, { params: { category: 'tv_show' } }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/home-posts`).catch(() => ({ data: [] })),
        ]);
        setMovies(movRes.data.slice(0, 12));
        setShows(showRes.data.slice(0, 12));
        setPosts(postRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const appUpdates      = posts.filter(p => p.category === 'app_update');
  const upcomingFeatures = posts.filter(p => p.category === 'upcoming_feature');

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="flex-1 bg-[#121212] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#0056A8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#121212] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-white text-4xl font-bold mb-1">{greeting}</h1>
          <p className="text-gray-400 text-base">Here's what's new on StreamVault</p>
        </div>

        {/* Upcoming Movies */}
        <Section
          title="Upcoming Movies"
          icon={<Play className="w-5 h-5 text-[#0056A8]" />}
          action={
            <button
              onClick={() => onViewChange?.('ondemand', 'movie')}
              className="flex items-center gap-1 text-[#0056A8] hover:text-blue-400 text-sm font-medium transition-colors"
              data-testid="home-see-all-movies"
            >
              See all <ChevronRight className="w-4 h-4" />
            </button>
          }
        >
          {movies.length === 0 ? (
            <Empty message="No movies in the library yet. Add movies in Admin → VOD to see them here." />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
              {movies.map(m => (
                <VODCard key={m.id} item={m} onClick={() => onViewChange?.('ondemand', 'movie')} />
              ))}
            </div>
          )}
        </Section>

        {/* New on TV */}
        <Section
          title="New on TV"
          icon={<Tv className="w-5 h-5 text-purple-400" />}
          action={
            <button
              onClick={() => onViewChange?.('ondemand', 'tv_show')}
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
              data-testid="home-see-all-shows"
            >
              See all <ChevronRight className="w-4 h-4" />
            </button>
          }
        >
          {shows.length === 0 ? (
            <Empty message="No TV shows in the library yet. Add shows in Admin → VOD to see them here." />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
              {shows.map(s => (
                <VODCard key={s.id} item={s} onClick={() => onViewChange?.('ondemand', 'tv_show')} />
              ))}
            </div>
          )}
        </Section>

        {/* App Updates */}
        <Section
          title="App Updates"
          icon={<Zap className="w-5 h-5 text-blue-400" />}
        >
          {appUpdates.length === 0 ? (
            <Empty message="No app updates posted yet. Add announcements in Admin → Home Feed." />
          ) : (
            <div className="space-y-3">
              {appUpdates.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </Section>

        {/* Upcoming Features */}
        <Section
          title="Upcoming Features & Changes"
          icon={<Star className="w-5 h-5 text-purple-400" />}
        >
          {upcomingFeatures.length === 0 ? (
            <Empty message="No upcoming features posted yet. Add announcements in Admin → Home Feed." />
          ) : (
            <div className="space-y-3">
              {upcomingFeatures.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
};

export default HomePage;
