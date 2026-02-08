import React, { useState, useEffect } from 'react';
import Withdrawals from './Withdrawals';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Save, RefreshCw, Settings, Eye, LogOut, AlertTriangle, CheckCircle, BarChart3, Star, Trophy } from 'lucide-react';
import './App.css';

function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'withdrawals'
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    house_edge: 0.20,
    rakeback_percentage: 0.50,
    star_accuracy_rates: {
      1: 0.50, 2: 0.55, 3: 0.60, 4: 0.70, 5: 0.85
    },
    last_updated: null,
    updated_by: null,
    version: '1.0'
  });
  const [globalLeaderboardConfig, setGlobalLeaderboardConfig] = useState({
    enabled: true,
    pot_max_participants: 1000,
    first_place_prize: 100,
    decay_rate: 0.00,
    min_payout: 0.01,
    min_withdrawal_amount: 5.00,
    last_updated: null,
    updated_by: null,
    version: '1.0'
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isGlobalConfigDirty, setIsGlobalConfigDirty] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [previewBet, setPreviewBet] = useState({ stake: 100, predictions: [] });
  const [accuracyInsights, setAccuracyInsights] = useState(null);
  const [starAccuracyInsights, setStarAccuracyInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
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
        loadGlobalLeaderboardConfig();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load config from Firestore
  const loadConfig = () => {
    const configRef = doc(db, 'app_config', 'pricing');
    const unsubscribe = onSnapshot(configRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const migratedConfig = {
          house_edge: data.house_edge || 0.20,
          rakeback_percentage: data.rakeback_percentage || 0.50,
          star_accuracy_rates: data.star_accuracy_rates || {
            1: 0.50, 2: 0.55, 3: 0.60, 4: 0.70, 5: 0.85
          },
          last_updated: data.last_updated,
          updated_by: data.updated_by,
          version: data.version || '1.0'
        };
        setConfig(migratedConfig);
        setIsDirty(false);
      }
    }, (error) => {
      console.error('Error listening to config:', error);
      setSaveStatus('error');
    });
    return unsubscribe;
  };

  // Load global leaderboard config from Firestore
  const loadGlobalLeaderboardConfig = () => {
    const configRef = doc(db, 'app_config', 'global_leaderboard');
    const unsubscribe = onSnapshot(configRef, (doc) => {
      if (doc.exists()) {
        setGlobalLeaderboardConfig(doc.data());
        setIsGlobalConfigDirty(false);
      } else {
        // Create default config if doesn't exist
        const defaultConfig = {
          enabled: true,
          pot_max_participants: 1000,
          first_place_prize: 100,
          decay_rate: 0.00,
          min_payout: 0.01,
          min_withdrawal_amount: 5.00,
          last_updated: new Date().toISOString(),
          updated_by: 'system',
          version: '1.0'
        };
        setDoc(configRef, defaultConfig);
      }
    }, (error) => {
      console.error('Error listening to global leaderboard config:', error);
    });
    return unsubscribe;
  };

  // Load accuracy insights
  const loadAccuracyInsights = async () => {
    setLoadingInsights(true);
    try {
      const predictionsRef = collection(db, 'predictions');
      const snapshot = await getDocs(predictionsRef);
      
      let totalPredictions = 0;
      let correctPredictions = 0;
      const starStats = { 1: { total: 0, correct: 0 }, 2: { total: 0, correct: 0 }, 3: { total: 0, correct: 0 }, 4: { total: 0, correct: 0 }, 5: { total: 0, correct: 0 } };
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        totalPredictions++;
        if (data.correct === true) correctPredictions++;
        
        const predictedRating = data.predictedRating;
        if (predictedRating >= 1 && predictedRating <= 5) {
          starStats[predictedRating].total++;
          if (data.correct === true) starStats[predictedRating].correct++;
        }
      });
      
      const calculatedAccuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) : 0;
      const starAccuracies = {};
      for (let star = 1; star <= 5; star++) {
        starAccuracies[star] = starStats[star].total > 0 
          ? (starStats[star].correct / starStats[star].total) : 0;
      }
      
      setAccuracyInsights({ totalPredictions, correctPredictions, calculatedAccuracy, lastUpdated: new Date().toISOString() });
      setStarAccuracyInsights({ starStats, starAccuracies, lastUpdated: new Date().toISOString() });
      
    } catch (error) {
      console.error('Error loading accuracy insights:', error);
      setAccuracyInsights(null);
      setStarAccuracyInsights(null);
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

  // Save global leaderboard config
  const saveGlobalLeaderboardConfig = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const updatedConfig = {
        ...globalLeaderboardConfig,
        last_updated: new Date().toISOString(),
        updated_by: user.email,
        version: (parseFloat(globalLeaderboardConfig.version) + 0.1).toFixed(1)
      };
      const configRef = doc(db, 'app_config', 'global_leaderboard');
      await setDoc(configRef, updatedConfig);
      setGlobalLeaderboardConfig(updatedConfig);
      setIsGlobalConfigDirty(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save global leaderboard config:', error);
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

  // Update global config values
  const updateGlobalConfigValue = (field, value) => {
    setGlobalLeaderboardConfig(prev => ({ ...prev, [field]: value }));
    setIsGlobalConfigDirty(true);
    setSaveStatus(null);
  };

  // Update star accuracy rate
  const updateStarAccuracy = (star, value) => {
    setConfig(prev => ({
      ...prev,
      star_accuracy_rates: { ...prev.star_accuracy_rates, [star]: value }
    }));
    setIsDirty(true);
    setSaveStatus(null);
  };

  // Calculate rakeback amount
  const calculateRakeback = (stake, houseEdge, rakebackPercentage) => {
    const houseEdgeTaken = stake * houseEdge;
    const rakebackAmount = houseEdgeTaken * rakebackPercentage;
    return Math.floor(rakebackAmount);
  };

  const calculateHouseEV = (predictions, houseEdge, rakebackPercentage, stake = 100) => {
    if (predictions.length === 0) return 0;
    
    // Calculate combined win probability
    const combinedWinProbability = predictions.reduce((total, star) => {
      return total * config.star_accuracy_rates[star];
    }, 1.0);
    
    // Use the actual multiplier being shown to users
    const actualMultiplier = calculateParlayMultiplier(predictions, houseEdge);
    
    // Gross House EV (before rakeback)
    const grossHouseEV = 1 - (combinedWinProbability * actualMultiplier);
    
    // Calculate ACTUAL rakeback paid (based on your current logic)
    const actualRakebackPaid = calculateRakeback(stake, houseEdge, rakebackPercentage);
    
    // Convert rakeback to percentage of stake
    const rakebackPercentageOfStake = actualRakebackPaid / stake;
    
    // Net House EV = Gross EV - Rakeback cost
    const netHouseEV = grossHouseEV - rakebackPercentageOfStake;
    
    return netHouseEV;
  };

  // Calculation functions
  const calculateSingleStarMultiplier = (starRating, houseEdge) => {
    const starAccuracy = config.star_accuracy_rates[starRating] || 0.5;
    const fairMultiplier = 1.0 / starAccuracy;
    const multiplier = fairMultiplier * (1.0 - houseEdge);
    const rounded = Math.floor(multiplier * 10) / 10; // Floor here
    return Math.max(rounded, 1.1);
  };
  
  const calculateParlayMultiplier = (predictions, houseEdge) => {
    if (!predictions.length) return 1.0;
    let finalMultiplier = 1.0;
    predictions.forEach(starRating => {
      const starMultiplier = calculateSingleStarMultiplier(starRating, houseEdge);
      finalMultiplier *= starMultiplier; // Multiply already-floored values
    });
    return Math.min(Math.floor(finalMultiplier * 10) / 10, 100.0); // Floor again at end
  };

  const calculatePayout = (stake, predictions, houseEdge) => {
    const multiplier = calculateParlayMultiplier(predictions, houseEdge);
    return Math.floor(stake * multiplier);
  };

  // Add stars to preview - allows duplicates
  const togglePreviewStar = (star) => {
    setPreviewBet(prev => {
      const newPredictions = [...prev.predictions];
      newPredictions.push(star);
      return { ...prev, predictions: newPredictions };
    });
  };

  // Remove specific prediction
  const removePreviewPrediction = (indexToRemove) => {
    setPreviewBet(prev => ({
      ...prev,
      predictions: prev.predictions.filter((_, index) => index !== indexToRemove)
    }));
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
            <h1>Control Room</h1>
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
      <div className="header">
        <div className="header-content">
        <div className="header-left">
            <Settings size={32} className="header-icon" />
            <div>
              <h1>Control Room</h1>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => setCurrentView('withdrawals')}
                  className={`nav-link ${currentView === 'withdrawals' ? 'active' : ''}`}
                >
                  Withdrawals
                </button>

                <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="btn btn-secondary">
              <LogOut size={16} />
              Logout
            </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {currentView === 'dashboard' ? (
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

                {/* Rakeback Percentage */}
                <div className="form-group">
                  <label>
                    Rakeback
                  </label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0"
                      max="1.0"
                      step="0.01"
                      value={config.rakeback_percentage}
                      onChange={(e) => updateValue('rakeback_percentage', parseFloat(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-value">
                      {(config.rakeback_percentage * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="description">Percentage of house edge returned to users as rakeback</p>
                </div>

                {/* Per-Star Accuracy Rates */}
                <div className="form-group">
                  <label className="section-label">Per-Star Accuracy Rates</label>
                  <div className="star-accuracy-grid">
                    {[1, 2, 3, 4, 5].map(star => (
                      <div key={star} className="star-accuracy-item">
                        <div className="star-header">
                          <div className="star-label">
                            <Star size={16} fill="currentColor" />
                            <span>{star} Star{star !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="multiplier-preview">
                            {calculateSingleStarMultiplier(star, config.house_edge).toFixed(1)}x
                          </div>
                        </div>
                        <div className="slider-container compact">
                          <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.01"
                            value={config.star_accuracy_rates[star]}
                            onChange={(e) => updateStarAccuracy(star, parseFloat(e.target.value))}
                            className="slider"
                          />
                          <div className="slider-value">
                            {(config.star_accuracy_rates[star] * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveConfig}
                  disabled={!isDirty || isSaving}
                  className={`btn btn-primary ${(!isDirty || isSaving) ? 'disabled' : ''}`}
                >
                  {isSaving ? <RefreshCw className="spinner" size={16} /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

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

            {/* Global Leaderboard Settings Panel */}
            <div className="card">
              <h2 className="card-title">
                <Trophy size={20} />
                Global Leaderboard Settings
              </h2>
              <div className="form-section">

                {/* Pot Size */}
                <div className="form-group">
                  <label>Pot Size (Max Participants)</label>
                  <input
                    type="number"
                    value={globalLeaderboardConfig.pot_max_participants}
                    onChange={(e) => updateGlobalConfigValue('pot_max_participants', parseInt(e.target.value) || 1000)}
                    className="form-input"
                    min="10"
                    step="100"
                  />
                  <p className="description">Maximum number of users per pot</p>
                </div>

                {/* First Place Prize */}
                <div className="form-group">
                  <label>First Place Prize ($)</label>
                  <input
                    type="number"
                    value={globalLeaderboardConfig.first_place_prize}
                    onChange={(e) => updateGlobalConfigValue('first_place_prize', parseFloat(e.target.value) || 100)}
                    className="form-input"
                    min="1"
                    step="10"
                  />
                  <p className="description">Prize amount for 1st place winner</p>
                </div>

                {/* Decay Rate */}
                <div className="form-group">
                  <label>Prize Decay Rate</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0"
                      max="0.95"
                      step="0.01"
                      value={globalLeaderboardConfig.decay_rate}
                      onChange={(e) => updateGlobalConfigValue('decay_rate', parseFloat(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-value">
                      {(globalLeaderboardConfig.decay_rate * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="description">
                    0% = Only 1st place wins. Higher % = More winners with decreasing prizes.
                  </p>
                </div>

                <button
                  onClick={saveGlobalLeaderboardConfig}
                  disabled={!isGlobalConfigDirty || isSaving}
                  className={`btn btn-primary ${(!isGlobalConfigDirty || isSaving) ? 'disabled' : ''}`}
                >
                  {isSaving ? <RefreshCw className="spinner" size={16} /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : 'Save Global Settings'}
                </button>
              </div>

              <div className="metadata">
                <div className="metadata-grid">
                  <div>
                    <span className="metadata-label">Last Updated:</span>
                    <span className="metadata-value">
                      {globalLeaderboardConfig.last_updated 
                        ? new Date(globalLeaderboardConfig.last_updated).toLocaleString() 
                        : 'Never'}
                    </span>
                  </div>
                  <div>
                    <span className="metadata-label">Updated By:</span>
                    <span className="metadata-value">
                      {globalLeaderboardConfig.updated_by || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Accuracy Insights & Preview Panels */}
            <div className="side-panels">
              {/* Accuracy Insights Panel */}
              <div className="card">
                <h2 className="card-title">
                  <BarChart3 size={20} />
                  Accuracy Insights
                </h2>
                <div className="form-section">
                  <button
                    onClick={loadAccuracyInsights}
                    disabled={loadingInsights}
                    className="btn btn-secondary full-width"
                  >
                    {loadingInsights ? <RefreshCw className="spinner" size={16} /> : <RefreshCw size={16} />}
                    {loadingInsights ? 'Loading...' : 'Refresh Data'}
                  </button>
                  
                  {accuracyInsights && (
                    <div className="insights-section">
                      <div className="overall-accuracy">
                        <h4>Overall Platform Stats</h4>
                        <div className="accuracy-results">
                          <div className="result-item">
                            <span>Total Predictions:</span>
                            <span>{accuracyInsights.totalPredictions.toLocaleString()}</span>
                          </div>
                          <div className="result-item">
                            <span>Correct Predictions:</span>
                            <span>{accuracyInsights.correctPredictions.toLocaleString()}</span>
                          </div>
                          <div className="result-item highlight">
                            <span>Overall Accuracy:</span>
                            <span className="calculated-accuracy">
                              {(accuracyInsights.calculatedAccuracy * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {starAccuracyInsights && (
                        <div className="star-insights">
                          <h4>Per-Star Analysis</h4>
                          <div className="star-insights-grid">
                            {[1, 2, 3, 4, 5].map(star => {
                              const actual = starAccuracyInsights.starAccuracies[star];
                              const configured = config.star_accuracy_rates[star];
                              const difference = actual - configured;
                              return (
                                <div key={star} className="star-insight-item">
                                  <div className="star-label">
                                    <Star size={14} fill="currentColor" />
                                    <span>{star}</span>
                                  </div>
                                  <div className="star-progress">
                                    <div className="progress-bar">
                                      <div 
                                        className="progress-fill" 
                                        style={{ width: `${actual * 100}%` }}
                                      ></div>
                                    </div>
                                    <div className="star-numbers">
                                      <span>{(actual * 100).toFixed(1)}%</span>
                                      <span className="sample-size">
                                        ({starAccuracyInsights.starStats[star].correct}/{starAccuracyInsights.starStats[star].total})
                                      </span>
                                    </div>
                                  </div>
                                  <div className={`difference ${Math.abs(difference * 100) > 5 ? 'significant' : 'minor'}`}>
                                    {difference > 0 ? '+' : ''}{(difference * 100).toFixed(1)}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!accuracyInsights && (
                    <p className="description">
                      Click "Refresh Data" to analyze current platform accuracy
                    </p>
                  )}
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
                    <label>Select Predictions</label>
                    <div className="star-selection">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          className="star-btn"
                          onClick={() => togglePreviewStar(star)}
                        >
                          <Star size={16} fill="currentColor" />
                          {star}
                          <div className="star-multiplier">
                            {calculateSingleStarMultiplier(star, config.house_edge).toFixed(1)}x
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {/* Show selected predictions with remove option */}
                    {previewBet.predictions.length > 0 && (
                      <div className="selected-predictions">
                        <label>Selected Predictions:</label>
                        <div className="prediction-chips">
                          {previewBet.predictions.map((star, index) => (
                            <div key={index} className="prediction-chip">
                              <Star size={12} fill="currentColor" />
                              <span>{star} Star</span>
                              <button 
                                onClick={() => removePreviewPrediction(index)}
                                className="remove-chip"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="preview-results">
                    {(() => {
                      const multiplier = calculateParlayMultiplier(previewBet.predictions, config.house_edge);
                      const payout = calculatePayout(previewBet.stake, previewBet.predictions, config.house_edge);
                      const profit = payout - previewBet.stake;
                      const houseEV = calculateHouseEV(previewBet.predictions, config.house_edge, config.rakeback_percentage, previewBet.stake);
                      const rakeback = calculateRakeback(previewBet.stake, config.house_edge, config.rakeback_percentage);
                      const netCost = previewBet.stake - rakeback;
                      
                      return (
                        <>
                          <div className="result-item">
                            <span>Predictions Count:</span>
                            <span>{previewBet.predictions.length}</span>
                          </div>
                          <div className="result-item">
                            <span>Total Multiplier:</span>
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
                          {rakeback > 0 && (
                            <>
                              <div className="divider"></div>
                              <div className="result-item">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  Rakeback:
                                </span>
                                <span>+{rakeback} coins</span>
                              </div>
                              <div className="result-item">
                                <span>Player's Net Cost:</span>
                                <span>{netCost} coins</span>
                              </div>
                            </>
                          )}
                          <div className="result-item highlight">
                            <span>House EV:</span>
                            <span className={`house-ev ${houseEV >= 0 ? 'positive' : 'negative'}`}>
                              {(houseEV * 100).toFixed(1)}%
                            </span>
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
      ) : currentView === 'withdrawals' ? (
        <Withdrawals />
      ) : null}
      
    </div>
  );
}

export default AdminDashboard;