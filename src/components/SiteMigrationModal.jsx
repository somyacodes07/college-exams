import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  Copy, 
  Check, 
  X
} from 'lucide-react';

const NEW_SITE_URL = 'https://yoruichi.zorodev.in/';
const WHATSAPP_BOT_URL = 'https://api.whatsapp.com/send/?phone=919547817967&text=Hi+YORUICHI%2C+I+want+to+know+more.&type=phone_number&app_absent=0';

const WhatsAppIcon = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SiteMigrationModal = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  // Prevent background scrolling on mobile when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WHATSAPP_BOT_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          {/* Subtle backdrop blur, theme aware */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container: Flex layout to handle overflow cleanly on small mobiles */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-[420px] max-h-[95vh] flex flex-col rounded-3xl bg-white dark:bg-[#0c101c] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Scrollable Content Area */}
            <div className="overflow-y-auto px-6 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-8 flex-1 custom-scrollbar">
              
              {/* Top row */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                  <span className="text-[11px] font-mono tracking-wider text-slate-500 dark:text-slate-400 uppercase font-bold">
                    System Update
                  </span>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 -mr-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Title */}
              <h2 className="text-[22px] sm:text-[24px] font-bold font-heading tracking-tight text-slate-900 dark:text-white mb-2 leading-snug">
                This site is retiring.
                <br />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Meet Yoruichi.</span>
              </h2>

              {/* Description */}
              <p className="text-slate-600 dark:text-slate-400 text-[14px] leading-relaxed mb-6 font-sans">
                We're moving Exam Scheduler to WhatsApp! <strong className="text-slate-900 dark:text-slate-200 font-semibold">Yoruichi</strong> is a smart WhatsApp bot that delivers your schedule directly to your phone.
              </p>

              {/* Clean Feature Box */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 p-4 sm:p-5 mb-6 space-y-3.5">
                <div className="flex items-center gap-2 text-[#25D366] text-xs sm:text-sm font-bold">
                  <WhatsAppIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Available directly on WhatsApp</span>
                </div>

                <div className="space-y-2.5 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <Calendar size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong className="text-slate-900 dark:text-slate-100 font-semibold">Exam Schedules:</strong> Dates, room seatings, and viva slots sent straight to your chat.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Clock size={16} className="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong className="text-slate-900 dark:text-slate-100 font-semibold">Daily Routine:</strong> Check today’s lectures, timetable, and subjects anytime.
                    </span>
                  </div>
                </div>
              </div>

              {/* Creator Thanks Note */}
              <div className="text-xs text-slate-400 mb-6 leading-relaxed border-l-2 border-emerald-500/40 pl-3">
                Thank you so much to everyone for using us by far! We built Exam Scheduler to make tracking college schedules a little simpler, and we hope the WhatsApp bot makes staying on track even easier.
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <a
                  href={WHATSAPP_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20be5a] text-white font-bold text-sm sm:text-[15px] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>Start using Yoruichi</span>
                  <ArrowUpRight size={18} />
                </a>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-3 px-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                  >
                    {copied ? (
                      <>
                        <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 text-xs sm:text-sm font-medium transition-colors text-center active:scale-[0.98]"
                  >
                    Close & stay
                  </button>
                </div>
              </div>

              {/* Clean link anchor */}
              <div className="mt-6 text-center">
                <a
                  href={NEW_SITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-mono transition-colors"
                >
                  yoruichi.zorodev.in
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SiteMigrationModal;
