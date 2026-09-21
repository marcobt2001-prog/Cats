/**
 * Generated Lean, lightly highlighted.
 *
 * Moved out of GameMode so the editor and the game show the same thing. The
 * operator class knows the categorical notation the generator emits (≫, 𝟙, ⟶),
 * and a line can be flagged so a diagnostic can point at it.
 */
const KEYWORDS = new Set([
  'import', 'variable', 'def', 'example', 'theorem', 'lemma',
  'where', 'let', 'in', 'by', 'exact', 'rfl', 'sorry',
  'open', 'namespace', 'end', 'section', 'noncomputable',
  'set_option', 'universe', 'local', 'notation',
  'first', 'simp_all', 'simp', 'only', 'aesop_cat', 'done',
]);

// Astral characters (𝟙, 𝒞) must be matched with the `u` flag or they split.
const TOKENS = /(\p{L}[\p{L}\p{N}_']*|[^\p{L}\p{N}\s]+|\s+)/gu;
const OPERATORS = /^(?:[{}()[\]]|:=|=>|≫|𝟙|⟶|∘|←|\||;|,|:|=)+$/u;

function highlight(line) {
  if (line.trimStart().startsWith('--')) return <span style={{ color: '#3d5a8a' }}>{line}</span>;
  const parts = [];
  let match;
  let i = 0;
  while ((match = TOKENS.exec(line)) !== null) {
    const token = match[0];
    let color = '#8899b0';
    if (KEYWORDS.has(token)) color = '#4db8ff';
    else if (/^\p{Lu}/u.test(token)) color = '#c8d3ea';
    else if (OPERATORS.test(token)) color = '#7b92b0';
    parts.push(<span key={i} style={{ color }}>{token}</span>);
    i += 1;
  }
  return parts;
}

export default function LeanCode({ code, highlightLines, showLineNumbers = false }) {
  const lines = code.split('\n');
  const width = String(lines.length).length;

  return (
    <pre style={{
      margin: 0,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {lines.map((line, i) => {
        const flagged = highlightLines?.has(i + 1);
        return (
          <div key={i} style={flagged
            ? { background: '#2a1216', borderLeft: '2px solid #ef4444', marginLeft: -8, paddingLeft: 6 }
            : undefined}>
            {showLineNumbers && (
              <span style={{ color: '#1e3256', userSelect: 'none' }}>
                {String(i + 1).padStart(width, ' ')}
              </span>
            )}
            {highlight(line)}
          </div>
        );
      })}
    </pre>
  );
}
