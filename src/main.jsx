/**
 * VIGIBYTE ENTRY POINT (main.jsx)
 * Purpose: Mounts the React application to the physical DOM.
 * * NOTE: React.StrictMode has been intentionally removed to prevent 
 * double-initialization of hardware resources (Camera feeds) and 
 * AI models during the development lifecycle.
 */

import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Initializing the Root element and rendering the VigiByte Core
createRoot(document.getElementById('root')).render(
  <App />
)