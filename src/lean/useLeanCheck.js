/**
 * Running a Lean check from React: availability, progress, and the result.
 *
 * A check takes seconds, so the caller needs a running flag and an elapsed
 * time, not a toast. Results that arrive after unmount are dropped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { probeLean, checkLean } from './client.js';

export function useLeanCheck() {
  const [availability, setAvailability] = useState({ available: false, reason: 'checking…' });
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    probeLean().then(status => { if (alive.current) setAvailability(status); });
    return () => { alive.current = false; };
  }, []);

  const run = useCallback(async source => {
    setRunning(true);
    setError('');
    setElapsedMs(0);
    const started = Date.now();
    const ticker = setInterval(() => {
      if (alive.current) setElapsedMs(Date.now() - started);
    }, 250);
    try {
      const value = await checkLean(source);
      if (!alive.current) return null;
      setResult(value);
      return value;
    } catch (e) {
      if (alive.current) {
        setError(String(e && e.message ? e.message : e));
        setResult(null);
      }
      return null;
    } finally {
      clearInterval(ticker);
      if (alive.current) {
        setElapsedMs(Date.now() - started);
        setRunning(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError('');
    setElapsedMs(0);
  }, []);

  return { availability, running, elapsedMs, result, error, run, reset };
}
