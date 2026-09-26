import React, { useEffect } from 'react';

const AdPlacement = () => {
  useEffect(() => {
    // This tells AdSense to load the ad into the <ins> tag when the component mounts
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto my-8 relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-[#111624] border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center min-h-[100px] p-4 text-center">
      <div className="absolute top-0 right-0 px-2 py-1 bg-slate-200/50 dark:bg-white/5 rounded-bl-lg text-[10px] uppercase font-mono font-bold text-slate-400 dark:text-slate-500 tracking-wider z-10">
        Advertisement
      </div>
      
      {/* Main Banner */}
      <ins 
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
