import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { issues, parsed } from '../state/preview.js';

/** Live anatomy verdict: green check, or tappable error/warning counts. */
export const LintChips = (): JSX.Element => {
  const [open, setOpen] = useState(false);
  const parseErrors = parsed.value.errors;
  const anatomy = issues.value;
  const errors = [...parseErrors, ...anatomy.filter((i) => i.severity === 'error').map((i) => i.message)];
  const warnings = anatomy.filter((i) => i.severity === 'warning').map((i) => i.message);

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div class="lint-chips">
        <span class="lint-chip ok" role="status">✓ sound</span>
      </div>
    );
  }

  return (
    <div class="lint-chips">
      <button
        class={`lint-chip ${errors.length > 0 ? 'err' : 'warn'}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {errors.length > 0 ? `${errors.length} issue${errors.length > 1 ? 's' : ''}` : `${warnings.length} note${warnings.length > 1 ? 's' : ''}`}
      </button>
      {open && (
        <div class="lint-list">
          {errors.map((message) => (
            <span key={message} style="color:var(--error)">{message}</span>
          ))}
          {warnings.map((message) => (
            <span key={message} style="color:var(--warn)">{message}</span>
          ))}
        </div>
      )}
    </div>
  );
};
