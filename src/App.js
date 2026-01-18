import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AdminDashboard from './AdminDashboard';
import RatingPage from './RatingPage';
import InfoPage from './InfoPage';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Rating page route with recruiterId and linkId params */}
        <Route path="/rate/:recruiterId/:linkId" element={<RatingPage />} />
        
        {/* Info page route (shown when app isn't installed) */}
        <Route path="/info/:recruiterId/:linkId" element={<InfoPage />} />
        
        {/* Admin dashboard */}
        <Route path="/admin/*" element={<AdminDashboard user={user} />} />
        
        {/* Default/home route */}
        <Route path="/" element={
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h1>SocialStar Rating System</h1>
            <p>Please use a valid rating link</p>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;