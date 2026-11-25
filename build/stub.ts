import React, { useState, useCallback } from 'react';
export const FileRouter: React.FC<{children?: React.ReactNode}> = ({ children }) => React.createElement(React.Fragment, null, children);
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, { ready: boolean; message?: string }] {
  const [value, setValue] = useState<T>(() => {
    try { const s = localStorage.getItem(key); if (s != null) return JSON.parse(s) as T; } catch {}
    return initial;
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [value, set, { ready: true, message: undefined }];
}
