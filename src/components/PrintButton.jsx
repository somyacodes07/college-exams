import React from 'react';
import { Printer } from 'lucide-react';

/** Print lives with the tabs: useful sometimes, never the main action. */
const PrintButton = () => (
  <button
    onClick={() => window.print()}
    className="inline-flex items-center gap-1.5 h-9 px-2 sm:px-2.5 rounded-md text-[14px] lg:text-[15px] font-semibold text-ink-soft hover:text-ink hover:bg-paper transition-colors print:hidden"
    title="Print or save as PDF"
    aria-label="Print or save as PDF"
  >
    <Printer size={16} /> <span className="hidden sm:inline">Print</span>
  </button>
);

export default PrintButton;
