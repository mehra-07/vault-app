import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'https://vault-app-eqhu.onrender.com';

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('vault_user') || '');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  const [items, setItems] = useState([]);
  const [folder, setFolder] = useState('Videos');
  const [uploadMode, setUploadMode] = useState('file'); // 'file', 'zip', 'drive'
  const [selectedFile, setSelectedFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeMedia, setActiveMedia] = useState(null);

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user]);

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

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    setStatusMsg('');

    try {
      if (uploadMode === 'file') {
        if (!selectedFile) {
          alert('Please select a file to upload');
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append('files', selectedFile);
        formData.append('folder', folder || 'General');
        formData.append('username', user);

        const res = await fetch(`${API_BASE}/api/vault/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setSelectedFile(null);
          const inp = document.getElementById('media-upload-input');
          if (inp) inp.value = '';
          setStatusMsg('✅ Upload successful!');
          fetchItems();
        } else {
          alert(data.error || 'Upload failed');
        }
      } else if (uploadMode === 'zip') {
        if (!selectedFile) {
          alert('Please select a .zip file');
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append('zipfile', selectedFile);
        formData.append('folder', folder || 'General');
        formData.append('username', user);

        const res = await fetch(`${API_BASE}/api/vault/upload-zip`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setSelectedFile(null);
          const inp = document.getElementById('media-upload-input');
          if (inp) inp.value = '';
          setStatusMsg('✅ ZIP extracted & uploaded successfully!');
          fetchItems();
        } else {
          alert(data.error || 'ZIP upload failed');
        }
      } else if (uploadMode === 'drive') {
        if (!driveUrl) {
          alert('Please enter a Google Drive link');
          setUploading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/api/vault/drive-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveUrl: driveUrl.trim(),
            folder: folder || 'General',
            username: user,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setDriveUrl('');
          setStatusMsg('✅ Google Drive media imported!');
          fetchItems();
        } else {
          alert(data.error || 'Drive download failed');
        }
      }
    } catch (err) {
      alert('Upload failed: Server connection error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this permanently?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/vault/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(items.filter((item) => item._id !== id));
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const videoCount = items.filter((i) => i.type === 'video').length;
  const imageCount = items.filter((i) => i.type === 'image').length;

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            <span className="logo-icon">🪐</span>
            <div className="logo-text">
              <h1 style={{ letterSpacing: '2px', fontSize: '1.8rem' }}>MEHRA SPACE</h1>
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
        <div className="logo-badge">
          <span className="logo-icon">🪐</span>
          <div className="logo-text">
            <h1>MEHRA SPACE</h1>
            <span>Private Storage</span>
          </div>
        </div>
        <div className="user-profile-badge">
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
            <p>Videos</p>
            <h2 style={{ color: 'var(--accent-cyan)' }}>{videoCount}</h2>
          </div>
          <div className="stat-icon">🎬</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>Images</p>
            <h2 style={{ color: 'var(--accent-blue)' }}>{imageCount}</h2>
          </div>
          <div className="stat-icon">📸</div>
        </div>
      </section>

      {/* Upload Zone with Mode Tabs */}
      <section className="upload-card">
        <div className="upload-mode-tabs">
          <button
            type="button"
            className={`mode-tab-btn ${uploadMode === 'file' ? 'active' : ''}`}
            onClick={() => { setUploadMode('file'); setSelectedFile(null); setStatusMsg(''); }}
          >
            📄 One by One (File)
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${uploadMode === 'zip' ? 'active' : ''}`}
            onClick={() => { setUploadMode('zip'); setSelectedFile(null); setStatusMsg(''); }}
          >
            🗜️ ZIP Archive (Auto-Extract)
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${uploadMode === 'drive' ? 'active' : ''}`}
            onClick={() => { setUploadMode('drive'); setSelectedFile(null); setStatusMsg(''); }}
          >
            ☁️ Google Drive Link
          </button>
        </div>

        <form className="upload-form" onSubmit={handleUpload}>
          <input
            type="text"
            className="input-box"
            placeholder="Folder (e.g. Videos, Personal)"
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
              placeholder="Paste public Google Drive file/folder URL..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />
          )}

          <button type="submit" className="btn-upload-submit" disabled={uploading}>
            {uploading ? 'Processing...' : '⚡ Upload'}
          </button>
        </form>

        {statusMsg && <p className="status-badge-msg">{statusMsg}</p>}
      </section>

      {/* Controls & Search */}
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
      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '3rem' }}>🪐</p>
          <h4>Space is empty</h4>
          <p>Upload files, a ZIP archive, or import via Drive above.</p>
        </div>
      ) : (
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
                  <h4 className="item-title" title={item.name}>
                    {item.name}
                  </h4>
                  <span className="item-folder">📁 {item.folder || 'General'}</span>
                  <div className="card-actions">
                    <button
                      className="btn-action-view"
                      onClick={() => setActiveMedia(item)}
                    >
                      {item.type === 'video' ? '▶ Play' : '👁 View'}
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
      )}

      {/* Media Player Modal */}
      {activeMedia && (
        <div className="modal-overlay" onClick={() => setActiveMedia(null)}>
          <div className="modal-theatre" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{activeMedia.name}</h3>
              <button
                className="btn-close-modal"
                onClick={() => setActiveMedia(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-player-box">
              {activeMedia.type === 'video' ? (
                <video
                  src={getMediaUrl(activeMedia.url)}
                  controls
                  autoPlay
                  crossOrigin="anonymous"
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
    </div>
  );
}