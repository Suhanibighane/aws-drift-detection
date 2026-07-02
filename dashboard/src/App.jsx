import React, { useState, useEffect } from 'react';
import { MOCK_DRIFT_HISTORY, MOCK_NEW_DRIFT } from './mockData';

function App() {
  // Load configuration from localStorage or defaults
  const [stackName, setStackName] = useState(() => localStorage.getItem('drift_stack_name') || 'ProductionCoreStack');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('drift_api_url') || 'https://api.yourdomain.com/Prod');
  const [isSimulating, setIsSimulating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedDrift, setSelectedDrift] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'DRIFTED', 'IN_SYNC'

  // Persist configs
  useEffect(() => {
    localStorage.setItem('drift_stack_name', stackName);
  }, [stackName]);

  useEffect(() => {
    localStorage.setItem('drift_api_url', apiUrl);
  }, [apiUrl]);

  // Initial load
  useEffect(() => {
    fetchHistory();
  }, [isSimulating, stackName]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      if (isSimulating) {
        // Load mock logs
        setHistory(MOCK_DRIFT_HISTORY);
      } else {
        // Fetch from actual API Gateway endpoint
        const response = await fetch(`${apiUrl}/history?stack_name=${stackName}`);
        if (!response.ok) throw new Error('API Gateway responded with an error');
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      alert(`Connection failed: Could not load data from live API. Falling back to simulation.`);
      setIsSimulating(true);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerCheck = async () => {
    setIsLoading(true);
    try {
      if (isSimulating) {
        // Simulate a drift trigger
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if we've already added the new drift
        const hasDrift = history.some(item => item.FriendlySummary.includes('StorageBucket'));
        
        if (hasDrift) {
          // If already drifted, simulate checking and returning the same state
          alert("Drift check completed! No new changes detected since the last check.");
        } else {
          // Add a new drift incident
          setHistory(prev => [MOCK_NEW_DRIFT, ...prev]);
          alert("Alert: New drift detected in S3 Resource! Notification sent via SNS.");
        }
      } else {
        // Call active Lambda endpoint
        const response = await fetch(`${apiUrl}/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stack_name: stackName,
            check_type: 'MANUAL'
          })
        });
        if (!response.ok) throw new Error('Failed to run live check');
        await fetchHistory();
      }
    } catch (error) {
      console.error("Error triggering check:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear local dashboard view logs?")) {
      setHistory([]);
    }
  };

  // Helper to format date
  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  // Determine current system status
  const currentStatus = history.length > 0 ? history[0].Status : 'UNKNOWN';

  // Filter items
  const filteredHistory = history.filter(item => {
    if (filter === 'DRIFTED') return item.Status === 'DRIFTED';
    if (filter === 'IN_SYNC') return item.Status === 'IN_SYNC';
    return true;
  });

  return (
    <>
      {/* Header */}
      <header>
        <div className="header-container">
          <div className="logo-section">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'hsl(var(--accent-blue))' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', lineHeight: 1 }}>DRIFT CONTROL</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>AWS & BEDROCK SECURE WATCH</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* System Status */}
            {currentStatus === 'IN_SYNC' && (
              <div className="badge-pulse badge-in-sync">
                <span></span>In Sync
              </div>
            )}
            {currentStatus === 'DRIFTED' && (
              <div className="badge-pulse badge-drifted">
                <span></span>Drift Active
              </div>
            )}
            {currentStatus === 'UNKNOWN' && (
              <div className="badge-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                <span></span>No Data
              </div>
            )}

            {/* Simulation toggle */}
            <div className="toggle-container" style={{ margin: 0, padding: '6px 12px', gap: '12px' }}>
              <div className="toggle-label">
                <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Mock Demo Mode</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={isSimulating} 
                  onChange={(e) => setIsSimulating(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        <div className="main-content">
          {/* Action Header bar */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Stack Check Center</h3>
              <p style={{ fontSize: '0.875rem' }}>Active stack being monitored: <strong style={{ color: 'var(--text-primary)' }}>{stackName}</strong></p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={triggerCheck} 
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div> Running Check...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    Check Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="glass-panel timeline-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '700' }}>Detection Timeline</h3>
              
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px' }}>
                {['ALL', 'DRIFTED', 'IN_SYNC'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    style={{
                      border: 'none',
                      background: filter === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: filter === t ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                </svg>
                <h4>No Checks Found</h4>
                <p style={{ fontSize: '0.875rem' }}>Run a stack scan to fetch or simulate logs.</p>
              </div>
            ) : (
              <div className="timeline">
                {filteredHistory.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <span className={`timeline-dot ${item.Status === 'DRIFTED' ? 'dot-drifted' : 'dot-in-sync'}`}></span>
                    <div className="glass-panel timeline-card" onClick={() => setSelectedDrift(item)}>
                      <div className="card-header">
                        <div className="card-title">
                          <span style={{ 
                            fontSize: '0.8rem', 
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            fontWeight: '600',
                            backgroundColor: item.CheckType === 'MANUAL' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                            color: item.CheckType === 'MANUAL' ? 'hsl(var(--accent-blue))' : 'var(--text-secondary)'
                          }}>
                            {item.CheckType}
                          </span>
                          <span style={{ fontWeight: '700' }}>
                            {item.Status === 'DRIFTED' ? 'Drift Detected' : 'Stack In Sync'}
                          </span>
                        </div>
                        <span className="time-stamp">{formatDate(item.Timestamp)}</span>
                      </div>

                      <p style={{ fontSize: '0.9rem' }}>
                        {item.Status === 'DRIFTED' 
                          ? `${item.Drifts.length} resource difference(s) detected.`
                          : 'Stack is fully synchronized with its IaC CloudFormation template.'
                        }
                      </p>

                      {/* AI Translation Summary Box */}
                      <div className="ai-summary-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'hsl(var(--accent-purple))' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                          AI EXPLANATION (LLAMA 3 8B)
                        </div>
                        {item.FriendlySummary}
                      </div>
                      
                      {item.Status === 'DRIFTED' && (
                        <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'hsl(var(--accent-blue))', fontWeight: 600 }}>
                          Click to view raw JSON diff 
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="sidebar">
          {/* AWS Connection Settings */}
          <div className="glass-panel config-card">
            <h3 style={{ marginBottom: '16px', fontWeight: '700' }}>Target AWS Config</h3>
            
            <div className="form-group">
              <label>Target Stack Name</label>
              <input 
                type="text" 
                value={stackName} 
                onChange={(e) => setStackName(e.target.value)} 
                className="input-field"
                placeholder="e.g. MyProductionCoreStack"
              />
            </div>

            <div className="form-group">
              <label>API Gateway Endpoint</label>
              <input 
                type="text" 
                value={apiUrl} 
                onChange={(e) => setApiUrl(e.target.value)} 
                className="input-field"
                placeholder="https://xxx.execute-api.us-east-1.amazonaws.com/Prod"
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={fetchHistory} className="btn-secondary" style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}>
                Reload Data
              </button>
              <button onClick={clearHistory} className="btn-secondary" style={{ padding: '8px', color: 'hsl(var(--accent-rose))' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* AI Workflow Card */}
          <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(180deg, rgba(124, 58, 237, 0.04) 0%, transparent 100%)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', marginBottom: '12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'hsl(var(--accent-purple))' }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              Bedrock AI pipeline
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
              When CloudFormation detects resource status as <code>MODIFIED</code> or <code>DELETED</code>, the raw change payload is packed into a custom system context prompt.
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
              <strong>Model:</strong> Meta Llama 3 8B Instruct<br/>
              <strong>Temperature:</strong> 0.2<br/>
              <strong>Input Tokens:</strong> ~500<br/>
              <strong>Cost:</strong> ~$0.00015 / call
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedDrift && (
        <div className="modal-overlay" onClick={() => setSelectedDrift(null)}>
          <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button className="modal-close" onClick={() => setSelectedDrift(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2 style={{ fontWeight: '800', marginBottom: '8px' }}>Drift Inspection</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '24px' }}>
              <span className={`badge-pulse ${selectedDrift.Status === 'DRIFTED' ? 'badge-drifted' : 'badge-in-sync'}`}>
                <span></span>{selectedDrift.Status}
              </span>
              <span className="time-stamp">{formatDate(selectedDrift.Timestamp)}</span>
            </div>

            <div className="ai-summary-box" style={{ fontSize: '1rem', padding: '16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--accent-purple))', marginBottom: '6px' }}>AI TRANSLATION EXPLANATION</div>
              "{selectedDrift.FriendlySummary}"
            </div>

            {selectedDrift.Drifts && selectedDrift.Drifts.length > 0 && (
              <div>
                <h3 style={{ fontWeight: '700', marginBottom: '12px' }}>Resource Mismatches ({selectedDrift.Drifts.length})</h3>
                
                <div className="diff-grid">
                  {selectedDrift.Drifts.map((d, idx) => (
                    <div key={idx} className="diff-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'hsl(var(--accent-blue))' }}>{d.ResourceType}</span>
                          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.LogicalResourceId}</h4>
                        </div>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          backgroundColor: 'rgba(244, 63, 94, 0.1)', 
                          color: 'hsl(var(--accent-rose))',
                          height: 'fit-content'
                        }}>
                          {d.StackResourceDriftStatus}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Physical Resource ID:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.PhysicalResourceId}</span>
                      </div>

                      {d.PropertyDifferences && d.PropertyDifferences.length > 0 && (
                        <div style={{ marginTop: '16px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PROPERTY DIFFERENCES</span>
                          
                          {d.PropertyDifferences.map((diff, diffIdx) => (
                            <div key={diffIdx} style={{ marginTop: '12px', borderTop: diffIdx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', paddingTop: diffIdx > 0 ? '12px' : 0 }}>
                              <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'hsl(var(--accent-amber))' }}>
                                <strong>Path:</strong> {diff.PropertyPath} ({diff.DifferenceType})
                              </div>
                              
                              <div className="diff-row">
                                <div>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>EXPECTED (IaC TEMPLATE)</div>
                                  <div className="diff-val-box val-expected">
                                    {diff.ExpectedValue}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>ACTUAL (LIVE CONSOLE)</div>
                                  <div className="diff-val-box val-actual">
                                    {diff.ActualValue}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
