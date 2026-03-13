import React, { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Tv, HelpCircle, MessageSquare, Activity, LogOut, User, Menu, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Portal session context
export const PortalContext = createContext(null);

export function usePortal() {
  return useContext(PortalContext);
}

export default function PortalLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [serviceName, setServiceName] = useState('StreamVault');
  const [logoPath, setLogoPath] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Restore portal session from localStorage
    const stored = localStorage.getItem('portal_session');
    if (stored) {
      try { setSession(JSON.parse(stored)); } catch {}
    }
    // Fetch service config for branding
    axios.get(`${API}/setup/config`).then(res => {
      setServiceName(res.data.service_name || 'StreamVault');
      setLogoPath(res.data.logo_path || '');
    }).catch(() => {});
  }, []);

  const login = (sessionData) => {
    setSession(sessionData);
    localStorage.setItem('portal_session', JSON.stringify(sessionData));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('portal_session');
    navigate('/portal');
  };

  const navLinks = [
    { to: '/portal', label: 'Home', icon: <User className="w-4 h-4" />, end: true },
    { to: '/portal/faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
    { to: '/portal/support', label: 'Submit Ticket', icon: <MessageSquare className="w-4 h-4" /> },
    { to: '/portal/status', label: 'Service Status', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <PortalContext.Provider value={{ session, login, logout, serviceName }}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoPath ? (
                <img src={`${BACKEND_URL}/api${logoPath}`} alt="Logo" className="h-9 w-auto" />
              ) : (
                <div className="w-9 h-9 bg-[#0056A8] rounded-lg flex items-center justify-center">
                  <Tv className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900 leading-tight">{serviceName}</p>
                <p className="text-xs text-gray-500 leading-tight">Support Portal</p>
              </div>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#0056A8] text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  {link.icon}
                  {link.label}
                </NavLink>
              ))}
              {session && (
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors ml-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </nav>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-3">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium my-0.5 transition-colors ${
                      isActive ? 'bg-[#0056A8] text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {link.icon}
                  {link.label}
                </NavLink>
              ))}
              {session && (
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              )}
            </div>
          )}
        </header>

        {/* Session badge */}
        {session && (
          <div className="bg-blue-50 border-b border-blue-100">
            <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
              <User className="w-4 h-4" />
              <span>Logged in as <strong>{session.device_name}</strong> — ID: <code className="font-mono text-xs">{session.user_id}</code></span>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white mt-16">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} {serviceName}. All rights reserved.</p>
            <p>Support Portal &nbsp;·&nbsp; Need immediate help? Contact your service provider.</p>
          </div>
        </footer>
      </div>
    </PortalContext.Provider>
  );
}
