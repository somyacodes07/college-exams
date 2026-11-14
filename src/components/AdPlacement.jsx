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
    <aside className="w-full my-8 [contain:layout_paint]" aria-label="Advertisement">
      <p className="mb-1.5 text-[12px] text-ink-faint">Advertisement</p>
      <div className="min-h-[100px] rounded-lg border border-rule bg-paper overflow-hidden">
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
    </aside>
  );
};

export default AdPlacement;
