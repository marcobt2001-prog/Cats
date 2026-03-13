import { useState } from 'react';
import { WORLDS, LEVELS } from './levels/index.js';
import { getCompletedLevels } from './completion.js';

export default function WorldSelect({ onSelectLevel, onBackToEditor }) {
  const [expandedWorld, setExpandedWorld] = useState(1);
  const completed = getCompletedLevels();

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: '#050812', overflowY: 'auto', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            color: '#c8d3ea', fontSize: 20,
            fontFamily: "'Crimson Text', serif", fontStyle: 'italic',
            letterSpacing: '0.04em', marginBottom: 6,
          }}>
            Category Theory Game
          </div>
          <div style={{
            color: '#3d5a8a', fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Following Aluffi's "Algebra: Chapter 0"
          </div>
        </div>

        {/* Worlds */}
        {WORLDS.map(world => {
          const isOpen = expandedWorld === world.id;
          const isUnlocked = world.id === 1;
          const worldLevels = world.levels.map(id => LEVELS[id]).filter(Boolean);
          const completedCount = worldLevels.filter(lv => completed.has(lv.id)).length;

          return (
            <div key={world.id} style={{ marginBottom: 2 }}>
              {/* World row */}
              <div
                onClick={() => setExpandedWorld(isOpen ? null : world.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: isOpen ? '#0c1220' : '#080d1a',
                  border: '1px solid',
                  borderColor: isOpen ? '#1a2540' : '#111928',
                  borderRadius: isOpen ? '6px 6px 0 0' : 6,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  opacity: isUnlocked ? 1 : 0.4,
                }}
              >
                <span style={{
                  color: isUnlocked ? '#a78bfa' : '#1e3256',
                  fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600, minWidth: 20,
                }}>
                  {world.id}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: isUnlocked ? '#c8d3ea' : '#2d4a7a',
                    fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {world.name}
                  </div>
                  <div style={{
                    color: '#2d4a7a', fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.06em', marginTop: 2,
                  }}>
                    Aluffi {world.aluffiRef}
                  </div>
                </div>
                {isUnlocked && worldLevels.length > 0 && (
                  <span style={{
                    color: completedCount === worldLevels.length ? '#6ee7b7' : '#3d5a8a',
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {completedCount}/{worldLevels.length}
                  </span>
                )}
                {!isUnlocked && (
                  <span style={{ color: '#1e3256', fontSize: 12 }}>🔒</span>
                )}
                <span style={{
                  color: '#3d5a8a', fontSize: 10,
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}>
                  ▶
                </span>
              </div>

              {/* Level tiles */}
              {isOpen && (
                <div style={{
                  background: '#0a0f1c',
                  border: '1px solid #1a2540',
                  borderTop: 'none',
                  borderRadius: '0 0 6px 6px',
                  padding: '8px',
                }}>
                  {worldLevels.length === 0 ? (
                    <div style={{
                      padding: '20px 16px',
                      color: '#1e3256', fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontStyle: 'italic', textAlign: 'center',
                    }}>
                      Coming soon
                    </div>
                  ) : (
                    worldLevels.map(lv => {
                      const isComplete = completed.has(lv.id);
                      return (
                        <div
                          key={lv.id}
                          onClick={() => onSelectLevel(lv.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'background 0.12s',
                            marginBottom: 2,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#111828'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Status badge */}
                          <span style={{
                            width: 22, height: 22,
                            borderRadius: '50%',
                            border: `1.5px solid ${isComplete ? '#6ee7b7' : '#2d4a7a'}`,
                            background: isComplete ? 'rgba(110,231,183,0.1)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, color: isComplete ? '#6ee7b7' : '#2d4a7a',
                            flexShrink: 0,
                          }}>
                            {isComplete ? '✓' : '○'}
                          </span>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <span style={{
                                color: '#4db8ff', fontSize: 10,
                                fontFamily: "'JetBrains Mono', monospace",
                                opacity: 0.7,
                              }}>
                                {lv.id}
                              </span>
                              <span style={{
                                color: '#c8d3ea', fontSize: 12,
                                fontFamily: "'JetBrains Mono', monospace",
                              }}>
                                {lv.title}
                              </span>
                            </div>
                            <div style={{
                              color: '#2d4a7a', fontSize: 9,
                              fontFamily: "'JetBrains Mono', monospace",
                              letterSpacing: '0.06em', marginTop: 2,
                            }}>
                              Aluffi {lv.aluffiRef}
                            </div>
                          </div>

                          {isComplete && (
                            <span style={{
                              color: '#6ee7b7', fontSize: 9,
                              fontFamily: "'JetBrains Mono', monospace",
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>
                              complete
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Back button */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button
            onClick={onBackToEditor}
            style={{
              background: 'transparent',
              border: '1px solid #1e3a5a',
              borderRadius: 4,
              color: '#4a6a8a',
              padding: '8px 20px',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.08em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            ← Back to Editor
          </button>
        </div>
      </div>
    </div>
  );
}
