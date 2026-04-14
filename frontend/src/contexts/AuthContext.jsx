import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyStoredToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          console.error('Token verification failed:', error);
          logout();
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    verifyStoredToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyToken = async () => {
    try {
      const response = await axios.get(`${API}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, two_fa_code = null) => {
    try {
      const body = { email, password };
      if (two_fa_code) body.two_fa_code = two_fa_code;
      const response = await axios.post(`${API}/auth/login`, body);
      const { access_token } = response.data;
      
      // Verify the token immediately with the new token
      try {
        const verifyResponse = await axios.get(`${API}/auth/verify`, {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        setUser(verifyResponse.data);
        setToken(access_token);
        localStorage.setItem('token', access_token);
        setLoading(false);
        return { success: true };
      } catch (verifyError) {
        console.error('Token verification failed:', verifyError);
        return {
          success: false,
          error: 'Authentication verification failed'
        };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
