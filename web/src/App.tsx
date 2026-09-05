import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { connectWebSocket, useStore } from './store';
import { api } from './api';
import NavRail from './components/NavRail';
import ConnectionBanner from './components/ConnectionBanner';
import Landing from './routes/Landing';
import NetworkDashboard from './routes/NetworkDashboard';
import ProviderConsole from './routes/ProviderConsole';
import RequesterConsole from './routes/RequesterConsole';
import JobDetail from './routes/JobDetail';

// Dev helper — expose store and api for browser console debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__store = useStore;
  (window as unknown as Record<string, unknown>).__api = api;
}

export default function App() {
  const bootstrap = useStore(s => s.bootstrap);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    bootstrap();
    connectWebSocket();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <div className="flex h-full">
        <ConnectionBanner />
        <NavRail />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[1140px] mx-auto px-8 py-7">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/network" element={<NetworkDashboard />} />
              <Route path="/provider" element={<ProviderConsole />} />
              <Route path="/request" element={<RequesterConsole />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
