'use client';
/* Hydrate browser storage after SSR; never read personal data on the server. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { localKey } from '@/lib/paths';
import { readLocal, writeLocal } from '@/lib/local-data';

// Callers provide module-level validators and defaults so loading runs only once.
export function useLocalState<T>(name: string, initial: T, validate: (v: unknown) => v is T) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try { setValue(readLocal(localStorage, localKey(name), validate, initial)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Local storage is unavailable.'); }
    setReady(true);
  }, [name, initial, validate]);
  function save(next: T) {
    try {
      writeLocal(localStorage, localKey(name), next);
      setValue(next);
      setError('');
      return true;
    } catch { setError('Could not save on this device. Check browser storage permissions or available space.'); return false; }
  }
  return { value, ready, error, save };
}
