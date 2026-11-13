import { useEffect, useState } from 'react';
import { getAtkt } from '../utils/api';

const REFRESH_MS = 60 * 1000;

/**
 * Loads a student's ATKT / re-exam entries and keeps them fresh: re-checks
 * every minute while the page is visible and whenever the tab regains focus,
 * so edits to the sheet show up without a reload.
 */
export function useAtkt(rollNo) {
  const [state, setState] = useState({ rollNo: null, exams: [], updatedAt: null });

  useEffect(() => {
    if (!rollNo) return undefined;
    let active = true;
    let controller = null;

    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      controller?.abort();
      controller = new AbortController();
      try {
        const { exams, updatedAt } = await getAtkt(rollNo, { signal: controller.signal });
        if (active) setState({ rollNo, exams, updatedAt });
      } catch {
        // Keep showing the last good data if a refresh fails
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);

    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [rollNo]);

  // Never show one student's entries while another student is open
  const current = state.rollNo === rollNo;
  return { exams: current ? state.exams : [], updatedAt: current ? state.updatedAt : null };
}
