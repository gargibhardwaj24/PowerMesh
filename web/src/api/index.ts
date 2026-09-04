import { mockApi } from './mock';
import { httpApi } from './http';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const api = USE_MOCKS ? mockApi : httpApi;
export type Api = typeof api;
