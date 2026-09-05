import { mockApi } from './mock';
import { httpApi } from './http';

export { CoordinatorApi, CoordinatorApiError, coordinatorApi } from './coordinator';
export type {
  CoordinatorJob,
  DemoSession,
  DeviceRegistration,
  JobEvent,
  JobSubscription,
  NetworkSummary as CoordinatorNetworkSummary,
  ProviderCapability,
  ProviderDevice,
  StreamConnectionState,
} from './coordinator';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const api = USE_MOCKS ? mockApi : httpApi;
export type Api = typeof api;
