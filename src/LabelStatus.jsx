import { printClassical } from './math/index.ts';

/**
 * One line under a morphism's name field saying what its label means:
 * an atomic morphism, a composite it stands for, or why it does not resolve.
 */
export default function LabelStatus({ status, ctx }) {
  if (!status) return null;

  const base = { fontSize: 10, fontFamily: 'monospace', marginTop: 2, lineHeight: 1.5 };

  if (status.kind === 'defined') {
    return (
      <span style={{ ...base, color: '#6ee7b7' }}>
        = {printClassical(ctx, status.expr)} &nbsp;(by definition)
      </span>
    );
  }

  if (status.kind === 'unresolved') {
    return <span style={{ ...base, color: '#f0a868' }}>cannot resolve: {status.error}</span>;
  }

  return <span style={{ ...base, color: '#3d5a8a' }}>atomic morphism · LaTeX ok</span>;
}
