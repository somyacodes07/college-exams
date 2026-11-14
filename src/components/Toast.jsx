import React, { useEffect, useState } from 'react';

/** Bottom-of-screen confirmation ("Roll number copied"). Fed by toast() in utils/copy. */
const Toast = () => {
  const [item, setItem] = useState(null);

  useEffect(() => {
    let timer;
    const onToast = (e) => {
      setItem(e.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setItem(null), 2400);
    };
    window.addEventListener('app-toast', onToast);
    return () => {
      window.removeEventListener('app-toast', onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-live="polite" className="print:hidden">
      {item && (
        <div
          key={item.id}
          className="toast fixed left-1/2 z-50 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg bg-ink text-paper text-[15px] lg:text-[16px] font-bold shadow-[0_12px_28px_-10px_rgba(28,42,71,0.5)]"
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))', transform: 'translateX(-50%)' }}
        >
          {item.message}
        </div>
      )}
    </div>
  );
};

export default Toast;
