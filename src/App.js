import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Save, RefreshCw, Settings, Eye, LogOut, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    house_edge: 0.30,
    accuracy_rate: 0.50,
    last_updated: null,
    updated_by: null,
    version: '1.0'
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [previewBet, setPreviewBet] = useState({ stake: 100, predictions: 3 });

  // Accuracy insights state
  const [accuracyInsights, setAccuracyInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        loadConfig();
      }
    });

    return () => unsubscribe();
  }, []);

  // Load config from Firestore with real-time updates
  const loadConfig = () => {
    const configRef = doc(db, 'app_config', 'pricing');
    
    const unsubscribe = onSnapshot(configRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConfig(data);
        setIsDirty(false);
      } else {
        console.log('No config document found, using defaults');
      }
    }, (error) => {
      console.error('Error listening to config:', error);
      setSaveStatus('error');
    });

    return unsubscribe;
  };

  // Load accuracy insights from predictions collection
  const loadAccuracyInsights = async () => {
    setLoadingInsights(true);
    try {
      const predictionsRef = collection(db, 'predictions');
      const snapshot = await getDocs(predictionsRef);
      
      let totalPredictions = 0;
      let correctPredictions = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        totalPredictions++;
        if (data.correct === true) {
          correctPredictions++;
        }
      });
      
      const calculatedAccuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) : 0;
      
      setAccuracyInsights({
        totalPredictions,
        correctPredictions,
        calculatedAccuracy,
        lastUpdated: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error loading accuracy insights:', error);
      setAccuracyInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Login function
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Save config to Firestore
  const saveConfig = async () => {
    setSaving(true);
    setSaveStatus(null);
    
    try {
      const updatedConfig = {
        ...config,
        last_updated: new Date().toISOString(),
        updated_by: user.email,
        version: (parseFloat(config.version) + 0.1).toFixed(1)
      };

      const configRef = doc(db, 'app_config', 'pricing');
      await setDoc(configRef, updatedConfig);
      
      setConfig(updatedConfig);
      setIsDirty(false);
      setSaveStatus('success');
      
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Update config values
  const updateValue = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveStatus(null);
  };

  // Calculation functions
  const calculateMultiplier = (predictions, houseEdge, accuracyRate) => {
    if (predictions <= 0) return 1.0;
    const winProbability = Math.pow(accuracyRate, predictions);
    const fairMultiplier = 1.0 / winProbability;
    return Math.min(fairMultiplier * (1.0 - houseEdge), 100.0);
  };

  const calculatePayout = (stake, predictions, houseEdge, accuracyRate) => {
    const multiplier = calculateMultiplier(predictions, houseEdge, accuracyRate);
    return Math.round(stake * multiplier);
  };

  // Show loading spinner on initial load
  if (loading) {
    return (
      <div className="loading-screen">
        <RefreshCw className="loading-spinner" size={32} />
        <p>Loading...</p>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <Settings size={32} className="login-icon" />
            <h1>Admin Dashboard</h1>
            <p>Sign in to manage competition settings</p>
          </div>
          
          <form onSubmit={handleLogin} className="login-form">
            {loginError && (
              <div className="alert alert-error">
                <AlertTriangle size={16} />
                {loginError}
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="admin@yourapp.com"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                placeholder="••••••••"
              />
            </div>
            
            <button type="submit" className="btn btn-primary full-width" disabled={loading}>
              {loading ? <RefreshCw className="spinner" size={16} /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="dashboard">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <Settings size={32} className="header-icon" />
            <div>
              <h1>Competition Admin Dashboard</h1>
              <p>Manage parlay betting parameters</p>
            </div>
          </div>
          
          <div className="header-right">
            {saveStatus === 'success' && (
              <div className="status-message success">
                <CheckCircle size={16} />
                Saved successfully
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="status-message error">
                <AlertTriangle size={16} />
                Save failed
              </div>
            )}
            
            <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="btn btn-secondary">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="dashboard-grid">
          {/* Configuration Panel */}
          <div className="card">
            <h2 className="card-title">
              <Settings size={20} />
              Pricing Parameters
            </h2>
            
            <div className="form-section">
              {/* House Edge */}
              <div className="form-group">
                <label>House Edge</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={config.house_edge}
                    onChange={(e) => updateValue('house_edge', parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-value">
                    {(config.house_edge * 100).toFixed(1)}%
                  </div>
                </div>
                <p className="description">Platform profit margin per bet</p>
              </div>

              {/* Accuracy Rate */}
              <div className="form-group">
                <label>Assumed Prediction Accuracy</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.01"
                    value={config.accuracy_rate}
                    onChange={(e) => updateValue('accuracy_rate', parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-value">
                    {(config.accuracy_rate * 100).toFixed(1)}%
                  </div>
                </div>
                <p className="description">Expected success rate per prediction</p>
              </div>

              {/* Save Button */}
              <button
                onClick={saveConfig}
                disabled={!isDirty || isSaving}
                className={`btn btn-primary ${(!isDirty || isSaving) ? 'disabled' : ''}`}
              >
                {isSaving ? (
                  <RefreshCw className="spinner" size={16} />
                ) : (
                  <Save size={16} />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Metadata */}
            <div className="metadata">
              <div className="metadata-grid">
                <div>
                  <span className="metadata-label">Last Updated:</span>
                  <span className="metadata-value">
                    {config.last_updated ? new Date(config.last_updated).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div>
                  <span className="metadata-label">Updated By:</span>
                  <span className="metadata-value">{config.updated_by || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Accuracy Insights Panel */}
          <div className="card">
            <h2 className="card-title">
              <BarChart3 size={20} />
              Accuracy Insights
            </h2>
            
            <div className="form-section">
              <div className="form-group">
                <label>Platform Data Analysis</label>
                <button
                  onClick={loadAccuracyInsights}
                  disabled={loadingInsights}
                  className="btn btn-secondary"
                >
                  {loadingInsights ? (
                    <RefreshCw className="spinner" size={16} />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {loadingInsights ? 'Loading...' : 'Refresh Data'}
                </button>
                
                {accuracyInsights && (
                  <div className="accuracy-results">
                    <div className="result-item">
                      <span>Total Predictions:</span>
                      <span>{accuracyInsights.totalPredictions.toLocaleString()}</span>
                    </div>
                    <div className="result-item">
                      <span>Correct Predictions:</span>
                      <span>{accuracyInsights.correctPredictions.toLocaleString()}</span>
                    </div>
                    <div className="result-item">
                      <span>Calculated Accuracy:</span>
                      <span className="calculated-accuracy">
                        {(accuracyInsights.calculatedAccuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="result-item">
                      <span>Current Setting:</span>
                      <span className="current-setting">
                        {(config.accuracy_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="result-item">
                      <span>Difference:</span>
                      <span className={`difference ${Math.abs((accuracyInsights.calculatedAccuracy - config.accuracy_rate) * 100) > 5 ? 'significant' : 'minor'}`}>
                        {((accuracyInsights.calculatedAccuracy - config.accuracy_rate) * 100) > 0 ? '+' : ''}
                        {((accuracyInsights.calculatedAccuracy - config.accuracy_rate) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
                
                {accuracyInsights && (
                  <p className="description">
                    Data refreshed: {new Date(accuracyInsights.lastUpdated).toLocaleString()}
                  </p>
                )}
                
                {!accuracyInsights && (
                  <p className="description">
                    Click "Refresh Data" to analyze current platform accuracy
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="card">
            <h2 className="card-title">
              <Eye size={20} />
              Live Preview
            </h2>
            
            <div className="form-section">
              <div className="form-group">
                <label>Test Stake Amount</label>
                <input
                  type="number"
                  value={previewBet.stake}
                  onChange={(e) => setPreviewBet(prev => ({ ...prev, stake: parseInt(e.target.value) || 0 }))}
                  className="form-input"
                  min="1"
                />
              </div>
              
              <div className="form-group">
                <label>Number of Predictions</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={previewBet.predictions}
                    onChange={(e) => setPreviewBet(prev => ({ ...prev, predictions: parseInt(e.target.value) }))}
                    className="slider"
                  />
                  <div className="slider-value">{previewBet.predictions}</div>
                </div>
              </div>
              
              <div className="preview-results">
                {(() => {
                  const winProb = Math.pow(config.accuracy_rate, previewBet.predictions);
                  const multiplier = calculateMultiplier(previewBet.predictions, config.house_edge, config.accuracy_rate);
                  const payout = calculatePayout(previewBet.stake, previewBet.predictions, config.house_edge, config.accuracy_rate);
                  const profit = payout - previewBet.stake;
                  
                  return (
                    <>
                      <div className="result-item">
                        <span>Win Probability:</span>
                        <span>{(winProb * 100).toFixed(1)}%</span>
                      </div>
                      <div className="result-item">
                        <span>Multiplier:</span>
                        <span className="multiplier">{multiplier.toFixed(1)}x</span>
                      </div>
                      <div className="result-item">
                        <span>Potential Payout:</span>
                        <span>{payout} coins</span>
                      </div>
                      <div className="result-item">
                        <span>Profit:</span>
                        <span className="profit">+{profit} coins</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;