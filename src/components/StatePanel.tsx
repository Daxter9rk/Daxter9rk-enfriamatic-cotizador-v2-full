import type {ReactNode} from 'react';

interface StatePanelProps {
  kind?: 'loading' | 'empty' | 'error' | 'success' | 'permission';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function StatePanel({kind = 'empty', title, children, action}: StatePanelProps) {
  return (
    <section
      className={`state-panel state-panel--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="state-panel__icon" aria-hidden="true">
        {kind === 'loading' ? '◌' : kind === 'error' ? '!' : kind === 'success' ? '✓' : '•'}
      </span>
      <div>
        <h2>{title}</h2>
        {children}
        {action}
      </div>
    </section>
  );
}
