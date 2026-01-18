import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { RefreshCw, Link as LinkIcon, Eye, MousePointer, Star, TrendingUp, Copy, Check, User } from 'lucide-react';

function RatingLinksAnalytics() {
  const [ratingLinks, setRatingLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt'); // 'createdAt', 'totalRatings', 'totalPageOpens', 'totalDownloadClicks'
  const [userData, setUserData] = useState({}); // Cache for both recruiter and assigned user details

  useEffect(() => {
    // Real-time listener for rating_links collection
    const q = query(collection(db, 'rating_links'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const links = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setRatingLinks(links);
      
      // Fetch user details for all unique recruiterIds and assignedUserIds
      const uniqueRecruiterIds = [...new Set(links.map(link => link.recruiterId).filter(Boolean))];
      const uniqueAssignedUserIds = [...new Set(links.map(link => link.assignedUserId).filter(Boolean))];
      const allUserIds = [...new Set([...uniqueRecruiterIds, ...uniqueAssignedUserIds])];
      
      await fetchUserDetails(allUserIds);
      
      setLoading(false);
    }, (error) => {
      console.error('Error loading rating links:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserDetails = async (userIds) => {
    const newUserData = {};
    
    for (const userId of userIds) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          newUserData[userId] = {
            name: data.name || 'Unknown',
            username: data.username || 'unknown',
            profilePictureUrl: data.profilePictureUrl || null
          };
        } else {
          newUserData[userId] = {
            name: 'Unknown User',
            username: 'unknown',
            profilePictureUrl: null
          };
        }
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        newUserData[userId] = {
          name: 'Error Loading',
          username: 'error',
          profilePictureUrl: null
        };
      }
    }
    
    setUserData(prev => ({ ...prev, ...newUserData }));
  };

  const copyToClipboard = (linkId, url) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const getSortedLinks = () => {
    const sorted = [...ratingLinks];
    
    switch(sortBy) {
      case 'totalRatings':
        return sorted.sort((a, b) => (b.totalRatings || 0) - (a.totalRatings || 0));
      case 'totalPageOpens':
        return sorted.sort((a, b) => (b.totalPageOpens || 0) - (a.totalPageOpens || 0));
      case 'totalDownloadClicks':
        return sorted.sort((a, b) => (b.totalDownloadClicks || 0) - (a.totalDownloadClicks || 0));
      case 'createdAt':
      default:
        return sorted.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
    }
  };

  const calculateConversionRate = (link) => {
    const opens = link.totalPageOpens || 0;
    const ratings = link.totalRatings || 0;
    if (opens === 0) return 0;
    return ((ratings / opens) * 100).toFixed(1);
  };

  const calculateClickThroughRate = (link) => {
    const ratings = link.totalRatings || 0;
    const clicks = link.totalDownloadClicks || 0;
    if (ratings === 0) return 0;
    return ((clicks / ratings) * 100).toFixed(1);
  };

  const calculateInfoClickRate = (link) => {
    const rateClicks = link.totalDownloadClicks || 0;
    const infoClicks = link.totalInfoContinueClicks || 0;
    if (rateClicks === 0) return 0;
    return ((infoClicks / rateClicks) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <RefreshCw className="loading-spinner" size={32} />
      </div>
    );
  }

  const sortedLinks = getSortedLinks();
  const totalStats = {
    totalLinks: ratingLinks.length,
    totalRatings: ratingLinks.reduce((sum, link) => sum + (link.totalRatings || 0), 0),
    totalPageOpens: ratingLinks.reduce((sum, link) => sum + (link.totalPageOpens || 0), 0),
    totalDownloadClicks: ratingLinks.reduce((sum, link) => sum + (link.totalDownloadClicks || 0), 0)
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <LinkIcon size={24} />
          Rating Links Analytics
        </h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
          Real-time tracking of all rating links and their performance
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <LinkIcon size={20} style={{ color: '#4ECDC4' }} />
            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Total Links</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalStats.totalLinks}</div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Eye size={20} style={{ color: '#45B7D1' }} />
            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Page Opens</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalStats.totalPageOpens}</div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Star size={20} style={{ color: '#FFD700' }} />
            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Total Ratings</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalStats.totalRatings}</div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <MousePointer size={20} style={{ color: '#FF6B6B' }} />
            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Continue Clicks</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalStats.totalDownloadClicks}</div>
        </div>
      </div>

      {/* Sort Controls */}
      <div style={{ 
        marginBottom: '16px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Sort by:</span>
        <button
          onClick={() => setSortBy('createdAt')}
          className={`btn ${sortBy === 'createdAt' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '14px' }}
        >
          Newest
        </button>
        <button
          onClick={() => setSortBy('totalRatings')}
          className={`btn ${sortBy === 'totalRatings' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '14px' }}
        >
          Most Ratings
        </button>
        <button
          onClick={() => setSortBy('totalPageOpens')}
          className={`btn ${sortBy === 'totalPageOpens' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '14px' }}
        >
          Most Opens
        </button>
        <button
          onClick={() => setSortBy('totalDownloadClicks')}
          className={`btn ${sortBy === 'totalDownloadClicks' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '14px' }}
        >
          Most Clicks
        </button>
      </div>

      {/* Links Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>Link Info</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={16} />
                    Recruiter
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={16} />
                    Assigned To
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Eye size={16} />
                    Opens
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Star size={16} />
                    Ratings
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <MousePointer size={16} />
                    Rate Clicks
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <MousePointer size={16} />
                    Info Clicks
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <TrendingUp size={16} />
                    Conversion
                  </div>
                </th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {sortedLinks.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)' }}>
                    No rating links found
                  </td>
                </tr>
              ) : (
                sortedLinks.map((link) => {
                  const recruiter = userData[link.recruiterId] || { name: 'Loading...', username: 'loading', profilePictureUrl: null };
                  const assignedUser = link.assignedUserId 
                    ? (userData[link.assignedUserId] || { name: 'Loading...', username: 'loading', profilePictureUrl: null })
                    : { name: 'Not Assigned', username: 'n/a', profilePictureUrl: null };
                  
                  // Helper component for user display
                  const UserDisplay = ({ user, isAssigned = false }) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {user.profilePictureUrl ? (
                        <img 
                          src={user.profilePictureUrl} 
                          alt={user.name}
                          style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '50%', 
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <User size={20} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>{user.name}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>@{user.username}</div>
                      </div>
                    </div>
                  );
                  
                  return (
                    <tr key={link.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontWeight: '600', marginBottom: '4px' }}>{link.title}</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>
                            ID: {link.linkId}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <a 
                            href={`/rate/${link.recruiterId}/${link.linkId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              fontSize: '12px', 
                              color: '#4ECDC4',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <LinkIcon size={12} />
                            View Page
                          </a>
                          <button
                            onClick={() => copyToClipboard(link.id, `${window.location.origin}/rate/${link.recruiterId}/${link.linkId}`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedLinkId === link.id ? '#4ECDC4' : 'rgba(255, 255, 255, 0.6)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px'
                            }}
                          >
                            {copiedLinkId === link.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedLinkId === link.id ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        {link.photoUrl && (
                          <div style={{ marginTop: '8px' }}>
                            <img 
                              src={link.photoUrl} 
                              alt="Link preview"
                              style={{ 
                                width: '60px', 
                                height: '60px', 
                                objectFit: 'cover', 
                                borderRadius: '8px' 
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <UserDisplay user={recruiter} />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <UserDisplay user={assignedUser} isAssigned={true} />
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                        {link.totalPageOpens || 0}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', color: '#FFD700' }}>
                        {link.totalRatings || 0}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                        {link.totalDownloadClicks || 0}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', color: '#22C55E' }}>
                        {link.totalInfoContinueClicks || 0}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ECDC4' }}>
                            {calculateConversionRate(link)}%
                          </span>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            Opens → Ratings
                          </div>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                            {calculateClickThroughRate(link)}%
                          </span>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            Ratings → Rate Clicks
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '14px', color: '#22C55E' }}>
                            {calculateInfoClickRate(link)}%
                          </span>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            Rate Clicks → Info Clicks
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                        {link.createdAt ? new Date(link.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default RatingLinksAnalytics;