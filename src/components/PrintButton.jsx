import React from 'react';
import { Printer } from 'lucide-react';

/** Print lives with the tabs: useful sometimes, never the main action. */
const PrintButton = () => (
  <button
    onClick={() => window.print()}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rule bg-paper px-3 text-sm font-semibold text-ink-soft hover:bg-muted hover:text-ink print:hidden"
    title="Print or save as PDF"
    aria-label="Print or save as PDF"
  >
    <Printer size={16} /> <span className="hidden sm:inline">Print</span>
  </button>
);

export default PrintButton;
