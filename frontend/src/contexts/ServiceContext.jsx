import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ServiceContext = createContext(null);

export const useService = () => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useService must be used within ServiceProvider');
  }
  return context;
};

export const ServiceProvider = ({ children }) => {
  const [serviceName, setServiceName] = useState('StreamVault');
  const [serviceConfig, setServiceConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServiceConfig();
  }, []);

  const fetchServiceConfig = async () => {
    try {
      const response = await axios.get(`${API}/setup/config`);
      if (response.data?.service_name) {
        setServiceName(response.data.service_name);
        setServiceConfig(response.data);
        localStorage.setItem('service_name', response.data.service_name);
      }
    } catch (error) {
      // Fall back to cached value if available
      const cachedName = localStorage.getItem('service_name');
      if (cachedName) setServiceName(cachedName);
    } finally {
      setLoading(false);
    }
  };

  const updateServiceName = (name) => {
    setServiceName(name);
    localStorage.setItem('service_name', name);
  };

  return (
    <ServiceContext.Provider
      value={{
        serviceName,
        serviceConfig,
        loading,
        updateServiceName,
        refreshConfig: fetchServiceConfig
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
};
