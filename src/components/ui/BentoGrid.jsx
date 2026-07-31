import React from 'react';
import { motion } from 'framer-motion';

export const BentoGrid = ({ children, className = "" }) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto ${className}`}
    >
      {children}
    </div>
  );
};

export const BentoCard = ({ title, description, icon: Icon, badge, children, className = "", delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`group relative overflow-hidden rounded-3xl bg-white dark:bg-[#121827]/70 border border-slate-200/90 dark:border-white/10 p-6 flex flex-col justify-between hover:border-emerald-500/40 shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.2)] transition-all duration-300 ${className}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
            {Icon && <Icon className="w-6 h-6" />}
          </div>
          {badge && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">
              {badge}
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white mb-1 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Content slot */}
      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
};
