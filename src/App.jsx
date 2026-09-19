import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = 'https://vault-app-eqhu.onrender.com';

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('vault_user') || '');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // Light / Dark Theme
  const [theme, setTheme] = useState(localStorage.getItem('vault_theme') || 'dark');

  const [items, setItems] = useState([]);
  const [folder, setFolder] = useState('Videos');
  const [uploadMode, setUploadMode] = useState('file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState('');
  
  // Progress & Toasts
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastText, setToastText] = useState('');

  // Regular Download States
  const [downloadModalItem, setDownloadModalItem] = useState(null);
  const [downloadingFormat, setDownloadingFormat] = useState(false);

  // BONUS SOCIAL DOWNLOADER MODAL STATES
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusUrl, setBonusUrl] = useState('');
  const [bonusFormat, setBonusFormat] = useState('video'); // 'video' or 'audio'
  const [bonusLoading, setBonusLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeMedia, setActiveMedia] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    if (user) {
      fetchItems();
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

  // Direct Browser Download
  const triggerSaveBlob = (blob, filename) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  };

  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); pos += 4;
    setUint32(length - 8); pos += 4;
    setUint32(0x45564157); pos += 4;
    setUint32(0x20746d66); pos += 4;
    setUint32(16); pos += 4;
    setUint16(1); pos += 2;
    setUint16(numOfChan); pos += 2;
    setUint32(sampleRate); pos += 4;
    setUint32(sampleRate * 2 * numOfChan); pos += 4;
    setUint16(numOfChan * 2); pos += 2;
    setUint16(16); pos += 2;
    setUint32(0x61746164); pos += 4;
    setUint32(length - pos - 4); pos += 4;

    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([out], { type: 'audio/wav' });
  };

  const downloadAs = async (format) => {
    if (!downloadModalItem) return;
    setDownloadingFormat(true);

    try {
      const targetUrl = getMediaUrl(downloadModalItem.url);
      const res = await fetch(targetUrl);
      const originalBlob = await res.blob();
      const baseName = downloadModalItem.name.replace(/\.[^/.]+$/, '');

      if (format === 'video' || downloadModalItem.type !== 'video') {
        const ext = downloadModalItem.name.split('.').pop() || 'mp4';
        triggerSaveBlob(originalBlob, `${baseName}.${ext}`);
      } else if (format === 'audio') {
        const arrayBuffer = await originalBlob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const wavBlob = audioBufferToWav(decodedBuffer);
        triggerSaveBlob(wavBlob, `${baseName}_audio.wav`);
      }
    } catch (err) {
      alert('Direct download started in background or failed.');
    } finally {
      setDownloadingFormat(false);
      setDownloadModalItem(null);
    }
  };

  // BONUS SOCIAL DOWNLOAD HANDLER (YT, Insta, FB, TikTok, X)
  const handleBonusDownload = async (e) => {
    e.preventDefault();
    if (!bonusUrl.trim()) {
      alert('Please paste a valid video or post link first!');
      return;
    }

    setBonusLoading(true);
    try {
      // Safe Universal Multi-Platform API Gateway
      const cleanUrl = encodeURIComponent(bonusUrl.trim());
      const serviceGateway = `https://api.cobalt.tools/api/json`;
      
      const response = await fetch(serviceGateway, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: bonusUrl.trim(),
          isAudioOnly: bonusFormat === 'audio',
          aFormat: 'mp3',
          vQuality: '1080'
        })
      });

      const data = await response.json();
      if (data && data.url) {
        // Direct Download Trigger
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = data.url;
        downloadAnchor.target = '_blank';
        downloadAnchor.download = `MehraSpace_${Date.now()}.${bonusFormat === 'audio' ? 'mp3' : 'mp4'}`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);

        setShowBonusModal(false);
        setBonusUrl('');
        setToastText(`⚡ ${bonusFormat.toUpperCase()} Download Started!`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3500);
      } else {
        // Fallback Instant Redirection
        window.open(`https://snapinsta.app/?url=${cleanUrl}`, '_blank');
        setShowBonusModal(false);
      }
    } catch (err) {
      // Fallback Engine
      window.open(`https://cobalt.tools/?url=${encodeURIComponent(bonusUrl.trim())}`, '_blank');
      setShowBonusModal(false);
    } finally {
      setBonusLoading(false);
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
    <div className="vault-container">
      {/* Top Header */}
      <header className="vault-header">
        <div className="logo-badge" title="Hover me for orbital spin!">
          <span className="planet-wrapper"><span className="logo-icon">🪐</span></span>
          <div className="logo-text">
            <h1 className="logo-title-animated">MEHRA SPACE</h1>
            <span className="logo-subtitle">Private Storage Vault</span>
            {/* BONUS FOR YOU CLICKABLE BOX */}
            <div
              className="bonus-banner-trigger"
              onClick={() => setShowBonusModal(true)}
              title="Click to download YouTube, Instagram & Social media videos"
            >
              🎁 Bonus for You <span style={{ opacity: 0.8 }}>[Click Here]</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Light / Dark Mode Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
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
            <div className="progress-header">
              <span style={{ color: 'var(--accent-cyan)' }}>TRANSFERRING TO CLOUD...</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-track">
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
                    onClick={() => setDownloadModalItem(item)}
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

      {/* FULLSCREEN THEATRE MODAL */}
      {activeMedia && (
        <div className="modal-overlay" onClick={() => setActiveMedia(null)}>
          <div className="modal-theatre" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{activeMedia.name}</h3>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {activeMedia.type === 'video' && (
                  <button
                    className="btn-pip-modal"
                    onClick={togglePictureInPicture}
                    title="Floating Mini Player"
                  >
                    📺 Mini Player
                  </button>
                )}
                <button
                  className="btn-modal-download-styled"
                  onClick={() => setDownloadModalItem(activeMedia)}
                  title="Download File"
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

      {/* REGULAR MEDIA DOWNLOAD MODAL */}
      {downloadModalItem && (
        <div className="modal-overlay" onClick={() => !downloadingFormat && setDownloadModalItem(null)}>
          <div className="download-choice-card" onClick={(e) => e.stopPropagation()}>
            <div className="download-choice-header">
              <h3>Download Media</h3>
              <p>{downloadModalItem.name}</p>
            </div>

            {downloadingFormat ? (
              <p style={{ margin: '2rem 0', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                Saving to device...
              </p>
            ) : (
              <div className="download-options-grid">
                <button
                  className="download-option-btn"
                  onClick={() => downloadAs('video')}
                >
                  <span className="opt-icon">🎬</span>
                  <div className="opt-text">
                    <strong>Full Video (.mp4)</strong>
                    <span>Complete video with sound</span>
                  </div>
                </button>

                <button
                  className="download-option-btn"
                  onClick={() => downloadAs('audio')}
                >
                  <span className="opt-icon">🎵</span>
                  <div className="opt-text">
                    <strong>Audio Only (.wav)</strong>
                    <span>Extract audio stream</span>
                  </div>
                </button>
              </div>
            )}

            {!downloadingFormat && (
              <button
                className="btn-cancel-download"
                onClick={() => setDownloadModalItem(null)}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* BONUS FOR YOU: SOCIAL MEDIA DOWNLOADER MODAL */}
      {showBonusModal && (
        <div className="modal-overlay" onClick={() => !bonusLoading && setShowBonusModal(false)}>
          <div className="bonus-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-bonus-modal" onClick={() => setShowBonusModal(false)}>
              ✕
            </button>
            <div className="bonus-header">
              <div style={{ fontSize: '2.4rem', marginBottom: '0.2rem' }}>🎁</div>
              <h3>Universal Media Extractor</h3>
              <p>Paste any video/audio link from YouTube, Instagram, Facebook, TikTok or X</p>
            </div>

            <div className="social-icons-row">
              <span className="social-pill">🔴 YouTube</span>
              <span className="social-pill">📸 Instagram</span>
              <span className="social-pill">🔵 Facebook</span>
              <span className="social-pill">🎵 TikTok</span>
              <span className="social-pill">🐦 Twitter / X</span>
            </div>

            <form onSubmit={handleBonusDownload}>
              <div className="bonus-input-group">
                <input
                  type="url"
                  className="bonus-input-field"
                  placeholder="https://www.youtube.com/... or instagram.com/reel/..."
                  value={bonusUrl}
                  onChange={(e) => setBonusUrl(e.target.value)}
                  required
                />
              </div>

              <div className="bonus-format-selector">
                <div
                  className={`bonus-format-card ${bonusFormat === 'video' ? 'active' : ''}`}
                  onClick={() => setBonusFormat('video')}
                >
                  <span className="icon">🎬</span>
                  <strong>Video (MP4)</strong>
                  <span>High Definition 1080p</span>
                </div>
                <div
                  className={`bonus-format-card ${bonusFormat === 'audio' ? 'active' : ''}`}
                  onClick={() => setBonusFormat('audio')}
                >
                  <span className="icon">🎵</span>
                  <strong>Audio (MP3)</strong>
                  <span>High Bitrate 320kbps</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn-bonus-download-now"
                disabled={bonusLoading}
              >
                {bonusLoading ? '⚡ Extracting Media...' : `⚡ Download ${bonusFormat.toUpperCase()} Now`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Popup */}
      {showToast && (
        <div className="toast-popup">
          <span className="toast-icon">🚀</span>
          <div className="toast-body">
            <h4>Success!</h4>
            <p>{toastText}</p>
          </div>
        </div>
      )}
    </div>
  );
}