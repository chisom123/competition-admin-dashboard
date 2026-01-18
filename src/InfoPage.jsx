import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  query, 
  collection, 
  where, 
  getDocs,
  orderBy,
  limit,
  getCountFromServer,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { Download, Star, Trophy, Clock, TrendingUp, ArrowRight } from 'lucide-react';

const InfoPage = () => {
  const { recruiterId, linkId } = useParams();
  const [linkData, setLinkData] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const [competitionData, setCompetitionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fingerprint, setFingerprint] = useState(null);

  // Generate fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      const components = [];
      
      components.push(`screen:${window.screen.width}x${window.screen.height}`);
      components.push(`colorDepth:${window.screen.colorDepth}`);
      components.push(`pixelRatio:${window.devicePixelRatio}`);
      components.push(`timezone:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      components.push(`language:${navigator.language}`);
      components.push(`platform:${navigator.platform}`);
      components.push(`hardwareConcurrency:${navigator.hardwareConcurrency || 'unknown'}`);
      
      const ua = navigator.userAgent;
      components.push(`mobile:${/Mobile|Android|iPhone/i.test(ua)}`);
      
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Fingerprint', 4, 17);
        const canvasData = canvas.toDataURL();
        components.push(`canvas:${canvasData.length}`);
      } catch (e) {
        components.push(`canvas:error`);
      }
      
      const fingerprintString = components.join('|');
      
      let hash = 0;
      for (let i = 0; i < fingerprintString.length; i++) {
        const char = fingerprintString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return Math.abs(hash).toString(36);
    };

    const initFingerprint = async () => {
      try {
        const fp = await generateFingerprint();
        setFingerprint(fp);
      } catch (error) {
        console.error('Error generating fingerprint:', error);
        const fallbackFp = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setFingerprint(fallbackFp);
      }
    };

    initFingerprint();
  }, []);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        // 1. Load rating link data
        const linksQuery = query(
          collection(db, 'rating_links'),
          where('linkId', '==', linkId)
        );
        const linkSnapshot = await getDocs(linksQuery);
        
        if (linkSnapshot.empty) {
          setLoading(false);
          return;
        }

        const linkDoc = linkSnapshot.docs[0];
        const link = { id: linkDoc.id, ...linkDoc.data() };
        setLinkData(link);

        // 2. Load assigned user data
        if (link.assignedUserId) {
          const userDoc = await getDoc(doc(db, 'users', link.assignedUserId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setAssignedUser({
              id: link.assignedUserId,
              name: userData.name,
              username: userData.username,
              profilePictureUrl: userData.profilePictureUrl,
              activePotId: userData.active_pot_id
            });

            // 3. Load competition data if user is in a pot
            if (userData.active_pot_id) {
              await loadCompetitionData(userData.active_pot_id, link.assignedUserId);
            }
          }
        }

      } catch (error) {
        console.error('Error loading data:', error);
      }
      setLoading(false);
    };

    if (linkId) {
      loadAllData();
    }
  }, [linkId]);

  const loadCompetitionData = async (potId, userId) => {
    try {
      // Get pot data
      const potDoc = await getDoc(doc(db, 'global_pots', potId));
      
      if (!potDoc.exists() || potDoc.data().status !== 'active') {
        return;
      }

      const potData = potDoc.data();

      // Get user's participant data
      const participantDoc = await getDoc(
        doc(db, 'global_pots', potId, 'participants', userId)
      );

      if (!participantDoc.exists()) {
        return;
      }

      const participantData = participantDoc.data();
      const userStars = participantData.total_stars || 0;

      // Count how many participants have MORE stars (efficient rank calculation)
      const higherRankedQuery = query(
        collection(db, 'global_pots', potId, 'participants'),
        where('total_stars', '>', userStars)
      );
      
      const higherRankedCount = await getCountFromServer(higherRankedQuery);
      const rank = higherRankedCount.data().count + 1;

      // Get total participants count
      const totalParticipantsCount = await getCountFromServer(
        collection(db, 'global_pots', potId, 'participants')
      );

      // Get top 3 for leaderboard preview
      const topParticipantsQuery = query(
        collection(db, 'global_pots', potId, 'participants'),
        orderBy('total_stars', 'desc'),
        limit(3)
      );
      
      const topParticipantsSnapshot = await getDocs(topParticipantsQuery);
      const topParticipants = topParticipantsSnapshot.docs.map(doc => doc.data());

      setCompetitionData({
        potId,
        endDate: potData.end_date?.toDate(),
        firstPlacePrize: potData.first_place_prize || 100,
        totalParticipants: totalParticipantsCount.data().count,
        maxParticipants: potData.max_participants || 1000,
        userRank: rank,
        userStars: userStars,
        topParticipants
      });

    } catch (error) {
      console.error('Error loading competition data:', error);
    }
  };

  const formatTimeRemaining = (endDate) => {
    if (!endDate) return 'Calculating...';
    
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) return 'Competition ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h Left`;
    if (hours > 0) return `${hours}h ${minutes}m Left`;
    return `${minutes}m Left`;
  };

  // Track unique continue button click from InfoPage
  const trackInfoContinueClick = async () => {
    if (!fingerprint || !linkData) {
      console.log('InfoPage: Skipping tracking - no fingerprint or linkData');
      return;
    }

    try {
      const trackingDocId = `${linkData.id}_${fingerprint}`;
      const trackingDocRef = doc(db, 'unique_info_continue_clicks', trackingDocId);
      
      // Check if this fingerprint has already clicked
      const trackingDoc = await getDoc(trackingDocRef);
      
      if (!trackingDoc.exists()) {
        // First time clicking - create tracking document
        await setDoc(trackingDocRef, {
          linkId: linkData.id,
          fingerprint: fingerprint,
          firstClickedAt: serverTimestamp(),
          clickCount: 1
        });

        // Increment UNIQUE continue clicks counter
        const linkDocRef = doc(db, 'rating_links', linkData.id);
        await updateDoc(linkDocRef, {
          totalInfoContinueClicks: increment(1),
          lastInfoContinueClickAt: serverTimestamp()
        });
        
        console.log('InfoPage: ✅ Tracked unique continue click');
      } else {
        // User has clicked before - just update their click count
        await updateDoc(trackingDocRef, {
          clickCount: increment(1),
          lastClickedAt: serverTimestamp()
        });
        
        console.log('InfoPage: Updated repeat click count');
      }
    } catch (error) {
      console.error('InfoPage: Error tracking continue click:', error);
    }
  };

  const handleDownload = async () => {
    // Track the click (non-blocking)
    trackInfoContinueClick();
    
    // Detect iOS or Android
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    
    if (isIOS) {
      window.location.href = 'https://apps.apple.com/gb/app/socialstar-app/id6473705189';
    } else {
      // Default to App Store, or add Play Store link when available
      window.location.href = 'https://apps.apple.com/gb/app/socialstar-app/id6473705189';
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#10183C',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: '3px solid #FFF',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#10183C',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      paddingTop: '0',
      paddingBottom: '20px'
    }}>
      {/* Content Container */}
      <div style={{
        width: '100%',
        maxWidth: '500px'
      }}>
        {/* Integrated Card Container */}
        <div style={{
          backgroundColor: '#1A2245',
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
          {/* Competition Title */}
          <div style={{
            padding: '24px 20px',
            textAlign: 'center'
          }}>
            <h1 style={{
              color: 'white',
              fontSize: '22px',
              fontWeight: 'bold',
              margin: 0
            }}>
              Photo Competition
            </h1>
          </div>

          {/* Divider */}
          <div style={{
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)'
          }} />

          {/* User Profile Section */}
          {assignedUser && (
            <>
              <div style={{
                padding: '24px 20px',
                textAlign: 'center'
              }}>
                {/* Profile Picture */}
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  margin: '0 auto 12px',
                  overflow: 'hidden',
                  border: '3px solid white'
                }}>
                  {assignedUser.profilePictureUrl ? (
                    <img 
                      src={assignedUser.profilePictureUrl}
                      alt={assignedUser.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px',
                      color: 'white'
                    }}>
                      {assignedUser.name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                {/* Name */}
                <h2 style={{
                  color: 'white',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  marginBottom: '16px'
                }}>
                  {assignedUser.name}
                </h2>

                {/* Competition Stats */}
                {competitionData ? (
                  <>
                    {/* Rank Badge */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'rgba(255, 215, 0, 0.15)',
                      padding: '10px 18px',
                      borderRadius: '50px',
                      marginBottom: '16px'
                    }}>
                      <Trophy size={18} color="#FFD700" />
                      <span style={{
                        color: '#FFD700',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}>
                        Rank #{competitionData.userRank}
                      </span>
                    </div>
                  </>
                ) : (
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '14px'
                  }}>
                    Not currently in a competition
                  </p>
                )}
              </div>

              {/* Stats Grid - Prize and Time (Full Width) */}
              {competitionData && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0'
                }}>
                  {/* Prize Box */}
                  <div style={{
                    backgroundColor: 'rgba(0, 255, 0, 0.15)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      marginBottom: '0px'
                    }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', fontWeight: '500' }}>
                        Prize
                      </span>
                    </div>
                    <div style={{ 
                      color: '#00FF00', 
                      fontSize: '22px', 
                      fontWeight: 'bold',
                      letterSpacing: '-0.5px'
                    }}>
                      ${competitionData.firstPlacePrize} Prize
                    </div>
                  </div>

                  {/* Time Left Box */}
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      marginBottom: '0px'
                    }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', fontWeight: '500' }}>
                        Time Left
                      </span>
                    </div>
                    <div style={{ 
                      color: 'white', 
                      fontSize: '22px', 
                      fontWeight: 'bold',
                      letterSpacing: '-0.5px'
                    }}>
                      {formatTimeRemaining(competitionData.endDate)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Integrated Download Button */}
          <button
            onClick={handleDownload}
            style={{
              width: '100%',
              backgroundColor: '#4169E1',
              color: 'white',
              border: 'none',
              borderRadius: '0',
              padding: '30px 20px',
              fontSize: '22px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'background-color 0.2s'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = '#3558c7';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = '#4169E1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#4169E1';
            }}
          >
            <span>Continue</span>
            <ArrowRight size={34} strokeWidth={2.5} style={{ marginLeft: 'auto' }} />
          </button>
        </div>

        {/* SocialStar Branding - Bottom Left */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          justifyContent: 'flex-start',
          marginTop: '30px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/ss-web-rate.firebasestorage.app/o/star-filled-fiveointed-shape-3.png?alt=media&token=a90a8c97-594c-49f0-82f0-a00519fbbd3a" 
              alt="Star icon" 
              style={{ width: '22px', height: '22px' }} 
            />
          </div>
          <span style={{ fontSize: '18px', color: 'white', fontWeight: 'bold' }}>
            SocialStar
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default InfoPage;