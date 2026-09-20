import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = 'https://vault-app-eqhu.onrender.com';

export default function App() {
  const [showVideo, setShowVideo] = useState(true);

  const [user, setUser] = useState(localStorage.getItem('vault_user') || '');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // 3-Way Theme State: 'dark' | 'light' | 'white'
  const [theme, setTheme] = useState(localStorage.getItem('vault_theme') || 'dark');

  const [items, setItems] = useState([]);
  const [folder, setFolder] = useState('Videos');
  const [uploadMode, setUploadMode] = useState('file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState('');
  
  // Progress & Toasts State
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastText, setToastText] = useState('');

  // COMING SOON MODAL STATE
  const [showComingSoon, setShowComingSoon] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeMedia, setActiveMedia] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  // Cycle between Dark -> Light -> White -> Dark
  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'white';
      return 'dark';
    });
  };

  // Fetch items whenever user logs in or changes
  useEffect(() => {
    if (user) {
      fetchItems();
      const interval = setInterval(fetchItems, 10000); // Auto-sync data across devices every 10s
      return () => clearInterval(interval);
    }
  }, [user]);

  // Video session for background playing
  useEffect(() => {
    if (activeMedia && activeMedia.type === 'video' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activeMedia.name,
        artist: 'MEHRA SPACE',
        album: activeMedia.folder || 'Vault Media'
      });
      navigator.mediaSession.setActionHandler('play', () => videoRef.current && videoRef.current.play());
      navigator.mediaSession.setActionHandler('pause', () => videoRef.current && videoRef.current.pause());
    }
  }, [activeMedia]);

  const fetchItems = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/vault?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error('Fetch items error:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (res.ok) {
        const loggedUser = data.user || authForm.username;
        setUser(loggedUser);
        localStorage.setItem('vault_user', loggedUser);
        fetchItems();
      } else {
        alert(data.message || 'Authentication failed');
      }
    } catch (err) {
      alert('Error connecting to backend server');
    }
  };

  const handleLogout = () => {
    setUser('');
    localStorage.removeItem('vault_user');
    setItems([]);
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // TRUE BLOB DOWNLOAD (DIRECT DEVICE SAVE ACROSS ALL DEVICES)
  const handleTrueDownload = async (item) => {
    const rawUrl = getMediaUrl(item.url);
    setToastText(`⬇️ Downloading ${item.name}...`);
    setShowToast(true);

    try {
      const response = await fetch(rawUrl, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      setToastText(`⚡ Download Complete!`);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      const a = document.createElement('a');
      a.href = rawUrl;
      a.download = item.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setShowToast(false);
    }
  };

  const togglePictureInPicture = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (uploadMode === 'file' && !selectedFile) {
      alert('Please select a file first');
      return;
    }
    if (uploadMode === 'zip' && !selectedFile) {
      alert('Please select a .zip archive');
      return;
    }
    if (uploadMode === 'drive' && !driveUrl) {
      alert('Please paste a Google Drive link');
      return;
    }

    setUploading(true);
    setProgress(20);

    const timer = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 10 : 90));
    }, 250);

    try {
      let res;
      if (uploadMode === 'file') {
        const formData = new FormData();
        formData.append('files', selectedFile);
        formData.append('folder', folder || 'General');
        formData.append('username', user);
        res = await fetch(`${API_BASE}/api/vault/upload`, { method: 'POST', body: formData });
      } else if (uploadMode === 'zip') {
        const formData = new FormData();
        formData.append('zipfile', selectedFile);
        formData.append('folder', folder || 'General');
        formData.append('username', user);
        res = await fetch(`${API_BASE}/api/vault/upload-zip`, { method: 'POST', body: formData });
      } else if (uploadMode === 'drive') {
        res = await fetch(`${API_BASE}/api/vault/drive-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveUrl: driveUrl.trim(), folder: folder || 'General', username: user }),
        });
      }

      clearInterval(timer);
      setProgress(100);

      if (res.ok) {
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          setSelectedFile(null);
          setDriveUrl('');
          const inp = document.getElementById('media-upload-input');
          if (inp) inp.value = '';
          setToastText('File Uploaded Successfully to Cloud!');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
          fetchItems();
        }, 500);
      } else {
        setUploading(false);
        alert('Upload failed');
      }
    } catch (err) {
      clearInterval(timer);
      setUploading(false);
      alert('Server upload error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this permanently?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/vault/${id}`, { method: 'DELETE' });
      if (res.ok) setItems(items.filter((i) => i._id !== id));
    } catch (err) {
      alert('Delete failed');
    }
  };

  const videoCount = items.filter((i) => i.type === 'video').length;
  const imageCount = items.filter((i) => i.type === 'image').length;

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.folder && item.folder.toLowerCase().includes(searchQuery.toLowerCase()));
    if (activeFilter === 'video') return matchesSearch && item.type === 'video';
    if (activeFilter === 'image') return matchesSearch && item.type === 'image';
    return matchesSearch;
  });

  // Intro Video Splash Screen
  if (showVideo) {
    return (
      <video 
        src="/1789846310586-276468114.mp4" 
        autoPlay 
        muted 
        playsInline 
        onEnded={() => setShowVideo(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 99999,
          backgroundColor: '#000'
        }}
      />
    );
  }

  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="logo-badge" style={{ marginBottom: '2rem', justifyContent: 'center' }}>
            <span className="planet-wrapper"><span className="logo-icon">🪐</span></span>
            <div className="logo-text">
              <h1 className="logo-title-animated">MEHRA SPACE</h1>
            </div>
          </div>
          <form className="auth-form" onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              className="input-box"
              value={authForm.username}
              onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="input-box"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              required
            />
            <button type="submit" className="btn-auth-submit">
              {isLoginView ? 'Enter Space →' : 'Create Space →'}
            </button>
          </form>
          <p className="auth-toggle">
            {isLoginView ? 'Need access?' : 'Already registered?'}{' '}
            <span onClick={() => setIsLoginView(!isLoginView)}>
              {isLoginView ? 'Register' : 'Login'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* LIVE WALLPAPER BACKGROUND VIDEO & OVERLAY */}
      <div className="bg-video-container">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="bg-video"
          src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-code-31930-large.mp4"
        />
      </div>
      <div className="bg-overlay" />

      <div className="vault-container">
        {/* Top Header */}
        <header className="vault-header">
          <div className="logo-badge" title="Hover for 3D orbital spin!">
            <span className="planet-wrapper"><span className="logo-icon">🪐</span></span>
            <div className="logo-text">
              <h1 className="logo-title-animated">MEHRA SPACE</h1>
              <span className="logo-subtitle">Private Storage Vault</span>
              
              {/* COMING SOON LAB TRIGGER BADGE */}
              <div
                className="coming-soon-trigger"
                onClick={() => setShowComingSoon(true)}
                title="Click to preview upcoming tools & features"
              >
                🚀 Coming Soon Lab [Click Here]
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="theme-toggle-btn"
              onClick={cycleTheme}
              title="Switch Theme (Dark / Light / White)"
            >
              {theme === 'dark' && '🌙 Dark Mode'}
              {theme === 'light' && '☀️ Light Mode'}
              {theme === 'white' && '⬜ White BG'}
            </button>

            <span className="username-tag">● {user}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-info">
              <p>Total Items</p>
              <h2>{items.length}</h2>
            </div>
            <div className="stat-icon">📦</div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <p>Videos Stored</p>
              <h2 style={{ color: 'var(--accent-cyan)' }}>{videoCount}</h2>
            </div>
            <div className="stat-icon">🎬</div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <p>Images Stored</p>
              <h2 style={{ color: 'var(--accent-blue)' }}>{imageCount}</h2>
            </div>
            <div className="stat-icon">📸</div>
          </div>
        </section>

        {/* Upload Zone */}
        <section className="upload-card">
          <div className="upload-methods-grid">
            <div
              className={`method-card ${uploadMode === 'file' ? 'active' : ''}`}
              onClick={() => { setUploadMode('file'); setSelectedFile(null); }}
            >
              <span className="method-icon">📄</span>
              <div className="method-title">Direct File</div>
              <div className="method-subtitle">Single / multiple media files</div>
            </div>

            <div
              className={`method-card ${uploadMode === 'zip' ? 'active' : ''}`}
              onClick={() => { setUploadMode('zip'); setSelectedFile(null); }}
            >
              <span className="method-icon">🗜️</span>
              <div className="method-title">ZIP Archive</div>
              <div className="method-subtitle">Auto-extract bulk media</div>
            </div>

            <div
              className={`method-card ${uploadMode === 'drive' ? 'active' : ''}`}
              onClick={() => { setUploadMode('drive'); setSelectedFile(null); }}
            >
              <span className="method-icon">☁️</span>
              <div className="method-title">Google Drive</div>
              <div className="method-subtitle">Import public folder/files</div>
            </div>
          </div>

          <form className="upload-form" onSubmit={handleUpload}>
            <input
              type="text"
              className="input-box"
              placeholder="Target Folder (e.g. Videos, Personal)"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            />

            {uploadMode === 'file' && (
              <div className="file-input-wrapper">
                <input
                  id="media-upload-input"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
            )}

            {uploadMode === 'zip' && (
              <div className="file-input-wrapper">
                <input
                  id="media-upload-input"
                  type="file"
                  accept=".zip"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
            )}

            {uploadMode === 'drive' && (
              <input
                type="url"
                className="input-box"
                placeholder="Paste public Google Drive share link..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            )}

            <button type="submit" className="btn-upload-submit" disabled={uploading}>
              {uploading ? '⚡ Uploading...' : '⚡ Upload Now'}
            </button>
          </form>

          {uploading && (
            <div className="progress-container">
              <div className="progress-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>TRANSFERRING TO CLOUD...</span>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{progress}%</span>
              </div>
              <div className="progress-track" style={{ marginTop: '6px' }}>
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </section>

        {/* Controls Bar */}
        <section className="controls-bar">
          <div className="filter-pills">
            <button
              className={`pill-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All ({items.length})
            </button>
            <button
              className={`pill-btn ${activeFilter === 'video' ? 'active' : ''}`}
              onClick={() => setActiveFilter('video')}
            >
              Videos ({videoCount})
            </button>
            <button
              className={`pill-btn ${activeFilter === 'image' ? 'active' : ''}`}
              onClick={() => setActiveFilter('image')}
            >
              Images ({imageCount})
            </button>
          </div>
          <input
            type="text"
            placeholder="🔍 Search..."
            className="input-box search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </section>

        {/* Gallery Cards */}
        <div className="media-grid">
          {filteredItems.map((item) => {
            const mediaUrl = getMediaUrl(item.url);
            return (
              <div key={item._id} className="item-card">
                <div className="preview-container">
                  <span className="type-badge">{item.type}</span>
                  {item.type === 'video' ? (
                    <>
                      <video
                        src={mediaUrl}
                        className="preview-media"
                        preload="metadata"
                        crossOrigin="anonymous"
                        playsInline
                      />
                      <button
                        className="play-overlay-btn"
                        onClick={() => setActiveMedia(item)}
                        title="Play"
                      >
                        ▶
                      </button>
                    </>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={item.name}
                      className="preview-media"
                      onClick={() => setActiveMedia(item)}
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                </div>
                <div className="card-content">
                  <h4 className="item-title" title={item.name}>{item.name}</h4>
                  <span className="item-folder">📁 {item.folder || 'General'}</span>
                  <div className="card-actions">
                    <button
                      className="btn-action-view"
                      onClick={() => setActiveMedia(item)}
                    >
                      {item.type === 'video' ? '▶ Play' : '👁 View'}
                    </button>
                    <button
                      className="btn-action-download"
                      onClick={() => handleTrueDownload(item)}
                      title="Download"
                    >
                      ⬇️ Download
                    </button>
                    <button
                      className="btn-action-delete"
                      onClick={() => handleDelete(item._id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FULLSCREEN THEATRE MODAL (WITH BACK BUTTON) */}
        {activeMedia && (
          <div className="modal-overlay" onClick={() => setActiveMedia(null)}>
            <div className="modal-theatre" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button
                    className="btn-back-vault"
                    onClick={() => setActiveMedia(null)}
                  >
                    ← Back to Vault
                  </button>
                  <h3 className="modal-title">{activeMedia.name}</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {activeMedia.type === 'video' && (
                    <button
                      className="theme-toggle-btn"
                      onClick={togglePictureInPicture}
                      title="Floating Mini Player"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                    >
                      📺 PiP
                    </button>
                  )}
                  <button
                    className="btn-modal-download-styled"
                    onClick={() => handleTrueDownload(activeMedia)}
                  >
                    ⬇️ Download
                  </button>
                  <button
                    className="btn-close-modal"
                    onClick={() => setActiveMedia(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="modal-player-box">
                {activeMedia.type === 'video' ? (
                  <video
                    ref={videoRef}
                    src={getMediaUrl(activeMedia.url)}
                    controls
                    autoPlay
                    crossOrigin="anonymous"
                    playsInline
                    preload="auto"
                    className="modal-media-elem"
                  />
                ) : (
                  <img
                    src={getMediaUrl(activeMedia.url)}
                    alt={activeMedia.name}
                    className="modal-media-elem"
                    style={{ objectFit: 'contain' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMING SOON LAB MODAL */}
        {showComingSoon && (
          <div className="modal-overlay" onClick={() => setShowComingSoon(false)}>
            <div className="cs-modal-card" onClick={(e) => e.stopPropagation()}>
              <button className="btn-close-cs-modal" onClick={() => setShowComingSoon(false)}>
                ✕
              </button>
              
              <div className="cs-header">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>⚡</div>
                <h3>MEHRA SPACE LAB</h3>
                <p>Next-Gen High Speed Web Tools Under Active Development</p>
              </div>

              <div className="cs-grid">
                <div className="cs-card">
                  <div className="cs-card-icon">📑</div>
                  <h4 className="cs-card-title">PDF & Image Studio</h4>
                  <p className="cs-card-desc">Seamlessly convert images to PDF, extract JPGs from PDFs, and adjust or resize image dimensions.</p>
                  <div className="cs-tags">
                    <span className="cs-tag">JPG to PDF</span>
                    <span className="cs-tag">PDF to JPG</span>
                    <span className="cs-tag">Image Resizer</span>
                  </div>
                  <div className="cs-status-pill">🔒 Coming Soon</div>
                </div>

                <div className="cs-card">
                  <div className="cs-card-icon">🎬</div>
                  <h4 className="cs-card-title">Universal Social Extractor</h4>
                  <p className="cs-card-desc">High-speed lossless media downloader for YouTube, Instagram Reels, Facebook & TikTok links.</p>
                  <div className="cs-tags">
                    <span className="cs-tag">YouTube / Insta</span>
                    <span className="cs-tag">Video (MP4)</span>
                    <span className="cs-tag">Audio (MP3)</span>
                  </div>
                  <div className="cs-status-pill">🔒 Coming Soon</div>
                </div>
              </div>

              <div className="cs-footer-actions">
                <button className="btn-back-vault" onClick={() => setShowComingSoon(false)}>
                  ← Back to Vault
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Popup */}
        {showToast && (
          <div className="toast-popup">
            <span className="toast-icon">🚀</span>
            <div className="toast-body">
              <h4>Notification</h4>
              <p>{toastText}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}