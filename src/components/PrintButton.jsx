import React from 'react';
import { Printer } from 'lucide-react';

/** Print lives with the tabs: useful sometimes, never the main action. */
const PrintButton = () => (
  <button
    onClick={() => window.print()}
    className="inline-flex size-9 sm:w-auto sm:px-2.5 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink print:hidden"
    title="Print or save as PDF"
    aria-label="Print or save as PDF"
  >
    <Printer size={16} /> <span className="hidden sm:inline">Print</span>
  </button>
);

export default PrintButton;
