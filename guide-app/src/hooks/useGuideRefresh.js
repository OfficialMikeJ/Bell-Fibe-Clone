import { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Polls /api/guide/last-updated every 30 s.
 * Calls `onContentChanged()` whenever the backend timestamp advances.
 * Safe to use multiple times — only the first mount sets the baseline.
 */
export default function useGuideRefresh(onContentChanged) {
  const lastTimestamp = useRef(null);
  const lastCount = useRef(null);

  const poll = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/guide/last-updated`);
      const { timestamp, program_count } = data;

      const isFirstPoll = lastTimestamp.current === null;

      if (!isFirstPoll) {
        const timestampChanged = timestamp !== lastTimestamp.current;
        const countIncreased = program_count > lastCount.current;
        if (timestampChanged || countIncreased) {
          onContentChanged();
        }
      }

      lastTimestamp.current = timestamp;
      lastCount.current = program_count;
    } catch {
      // Network error — silent fail, try again next interval
    }
  }, [onContentChanged]);

  useEffect(() => {
    poll(); // baseline on mount
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);
}
