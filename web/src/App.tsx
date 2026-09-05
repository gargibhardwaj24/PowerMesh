import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store';
import NavRail from './components/NavRail';
import ConnectionBanner from './components/ConnectionBanner';
import Landing from './routes/Landing';
import NetworkDashboard from './routes/NetworkDashboard';
import ProviderConsole from './routes/ProviderConsole';
import RequesterConsole from './routes/RequesterConsole';
import JobDetail from './routes/JobDetail';

const REFRESH_INTERVAL_MS = 2_000;

export default function App() {
  const bootstrap = useStore(s => s.bootstrap);
  const refresh = useStore(s => s.refresh);

  useEffect(() => {
    let disposed = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    const start = async () => {
      await bootstrap();
      if (!disposed) refreshTimer = setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    };
    void start();
    return () => {
      disposed = true;
      if (refreshTimer !== null) clearInterval(refreshTimer);
    };
  }, [bootstrap, refresh]);

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
