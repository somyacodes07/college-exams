import React, { useEffect, useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { readRecent, removeRecent, displayRoll } from '../utils/recent';
import { copyText } from '../utils/copy';

/**
 * Home-page shortcut for the most common task: copying your own roll number.
 * Shows students opened on this device with a one-tap copy, no search needed.
 */
const QuickCopy = ({ onOpen }) => {
  const [recent, setRecent] = useState(readRecent);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    const sync = () => setRecent(readRecent());
    window.addEventListener('recent-change', sync);
    return () => window.removeEventListener('recent-change', sync);
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (recent.length === 0) return null;
  const [mine, ...others] = recent;

  const copy = async (s) => {
    if (await copyText(displayRoll(s), `Roll number ${displayRoll(s)} copied`)) setCopied(s.rollNo);
  };

  return (
    <section className="reveal mt-6 lg:mt-8 max-w-2xl lg:max-w-3xl" aria-label="Your roll number">
      <div className="bg-paper border border-rule rounded-xl p-4 lg:p-5">
        <p className="text-[14px] lg:text-[16px] text-ink-faint">Last opened on this device</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => onOpen(mine)} className="min-w-0 text-left rounded-md">
            <span className="block text-[18px] lg:text-[22px] font-extrabold leading-tight truncate">{mine.name}</span>
            <span className="block text-[14px] lg:text-[16px] text-ink-soft underline decoration-rule underline-offset-4 hover:decoration-ink">Open schedule</span>
          </button>
          <button
            onClick={() => copy(mine)}
            className={`inline-flex items-center gap-3 h-14 lg:h-16 px-4 lg:px-5 rounded-lg border transition-colors ${copied === mine.rollNo ? 'pop border-practical bg-practical-tint' : 'border-ink bg-ink text-paper hover:opacity-90'}`}
            aria-label={`Copy roll number ${displayRoll(mine)}`}
          >
            <span className={`tnum text-[22px] lg:text-[28px] font-extrabold tracking-[0.01em] ${copied === mine.rollNo ? 'text-ink' : ''}`}>{displayRoll(mine)}</span>
            <span className={`inline-flex items-center gap-1 text-[14px] lg:text-[16px] font-bold ${copied === mine.rollNo ? 'text-practical' : ''}`}>
              {copied === mine.rollNo ? <><Check size={17} strokeWidth={2.5} /> Copied</> : <><Copy size={16} /> Copy</>}
            </span>
          </button>
        </div>

        {others.length > 0 && (
          <ul className="mt-4 pt-3 border-t border-rule">
            {others.map((s) => (
              <li key={s.rollNo} className="flex items-center justify-between gap-3 py-1.5">
                <button onClick={() => onOpen(s)} className="min-w-0 text-left rounded-md">
                  <span className="block text-[15px] lg:text-[17px] font-bold truncate">{s.name}</span>
                  <span className="block tnum text-[13px] lg:text-[15px] text-ink-faint">{displayRoll(s)}</span>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => copy(s)}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-rule text-[14px] font-bold text-ink-soft hover:text-ink hover:border-ink-faint"
                    aria-label={`Copy roll number of ${s.name}`}
                  >
                    {copied === s.rollNo ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                  </button>
                  <button
                    onClick={() => setRecent(removeRecent(s.rollNo))}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-desk"
                    aria-label={`Remove ${s.name} from this list`}
                    title="Remove from this list"
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default QuickCopy;
