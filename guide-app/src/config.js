// API URL configuration for the guide app
// In production, set REACT_APP_API_URL in .env before building

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';
const GUIDE_TITLE = process.env.REACT_APP_GUIDE_TITLE || 'StreamVault TV';

export { API_URL, GUIDE_TITLE };
export default API_URL;
