// Centralized logger for Strix API
// All logs are prefixed with [STRIX] and timestamp for easy grep/filtering

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug'; // 'debug' | 'info' | 'error'

function ts() {
  return new Date().toISOString();
}

export const log = {
  info: (tag: string, msg: string, data?: object) => {
    console.log(`[STRIX][INFO][${ts()}][${tag}] ${msg}`, data ? JSON.stringify(data) : '');
  },
  debug: (tag: string, msg: string, data?: object) => {
    if (LOG_LEVEL === 'debug') {
      console.log(`[STRIX][DEBUG][${ts()}][${tag}] ${msg}`, data ? JSON.stringify(data) : '');
    }
  },
  warn: (tag: string, msg: string, data?: object) => {
    console.warn(`[STRIX][WARN][${ts()}][${tag}] ${msg}`, data ? JSON.stringify(data) : '');
  },
  error: (tag: string, msg: string, err?: unknown) => {
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err ?? '');
    console.error(`[STRIX][ERROR][${ts()}][${tag}] ${msg}`, errMsg);
  },
};
