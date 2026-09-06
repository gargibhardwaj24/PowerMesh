import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store';
import NavRail from './components/NavRail';
import ToastViewport from './components/ToastViewport';
import Landing from './routes/Landing';
import NetworkDashboard from './routes/NetworkDashboard';
import ProviderConsole from './routes/ProviderConsole';
import RequesterConsole from './routes/RequesterConsole';
import JobDetail from './routes/JobDetail';

const REFRESH_INTERVAL_MS = 2_000;
const ROUTE_ORDER = ['/', '/network', '/provider', '/request'] as const;

function routeIndex(pathname: string): number {
  if (pathname.startsWith('/jobs/')) return ROUTE_ORDER.indexOf('/request');
  const index = ROUTE_ORDER.indexOf(pathname as (typeof ROUTE_ORDER)[number]);
  return index < 0 ? 0 : index;
}

function RoutedContent() {
  const location = useLocation();
  const previousIndex = useRef(routeIndex(location.pathname));
  const currentIndex = routeIndex(location.pathname);
  const direction = currentIndex >= previousIndex.current ? 1 : -1;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    previousIndex.current = currentIndex;
  }, [currentIndex]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="route-frame"
        initial={reduceMotion ? false : { opacity: 0, x: direction * 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -8 }}
        transition={{ duration: reduceMotion ? 0 : 0.19, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/network" element={<NetworkDashboard />} />
          <Route path="/provider" element={<ProviderConsole />} />
          <Route path="/request" element={<RequesterConsole />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

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
      <div className="app-shell">
        <NavRail />
        <main className="app-main" id="main-content">
          <div className="app-canvas">
            <RoutedContent />
          </div>
        </main>
        <ToastViewport />
      </div>
    </BrowserRouter>
  );
}
