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
          className="toast fixed left-1/2 z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-rule bg-paper px-3 py-3 text-sm text-ink shadow-lg"
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))', transform: 'translateX(-50%)' }}
        >
          {item.message}
        </div>
      )}
    </div>
  );
};

export default Toast;
