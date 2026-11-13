import React, { useEffect, useRef } from 'react';

/**
 * AdSense banner, filled lazily: only once the slot is near the viewport,
 * has a real width, and the browser is idle. Pushing earlier blocked the main
 * thread during page load and threw "No slot size for availableWidth=0".
 */
const AdPlacement = () => {
  const slotRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return undefined;

    const fill = () => {
      if (pushed.current || el.offsetWidth === 0) return;
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ad blockers or AdSense errors must never break the page */
      }
    };

    const whenIdle = (fn) =>
      'requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500);

    if (!('IntersectionObserver' in window)) {
      whenIdle(fill);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          whenIdle(fill);
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto my-8 relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-[#111624] border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center min-h-[100px] p-4 text-center [contain:layout_paint]">
      <div className="absolute top-0 right-0 px-2 py-1 bg-slate-200/50 dark:bg-white/5 rounded-bl-lg text-[10px] uppercase font-mono font-bold text-slate-400 dark:text-slate-500 tracking-wider z-10">
        Advertisement
      </div>
      <ins
        ref={slotRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client="ca-pub-9010905957176372"
        data-ad-slot="9322138970"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdPlacement;
