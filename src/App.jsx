import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Live Render backend URL
const SERVER_URL = 'https://vault-app-eqhu.onrender.com';
const API_BASE = `${SERVER_URL}/api/vault`;
const AUTH_BASE = `${SERVER_URL}/api/auth`;

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('vaultUser') || null);
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [activeMedia, setActiveMedia] = useState(null);

  // Video Modal Player State
  const [playingVideo, setPlayingVideo] = useState(null); // Item object
  const [playerSize, setPlayerSize] = useState('full'); // 'full' | 'small'
  const [volume, setVolume] = useState(1);
  const videoPlayerRef = useRef(null);

  const [theme, setTheme] = useState(localStorage.getItem('vaultTheme') || 'light');

  const [uploadMethod, setUploadMethod] = useState('single');
  const [driveUrl, setDriveUrl] = useState('');
  const [driveFileName, setDriveFileName] = useState('');
  const [folderMode, setFolderMode] = useState('new');
  const [chosenFolder, setChosenFolder] = useState('General');
  const [newFolderName, setNewFolderName] = useState('');

  const [selectedFolderTab, setSelectedFolderTab] = useState('ALL');
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [zipping, setZipping] = useState(false);

  const fetchVaultItems = useCallback(async (username) => {
    if (!username) return;
    try {
      const res = await fetch(`${API_BASE}?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
        if (data.length > 0) setActiveMedia(data[0]);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchVaultItems(user);
    }
  }, [user, fetchVaultItems]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('vaultTheme', nextTheme);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/login' : '/register';
      const res = await fetch(`${AUTH_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.user) {
        setAuthError(data.message || 'Auth Error');
        return;
      }

      setUser(data.user);
      localStorage.setItem('vaultUser', data.user);
      fetchVaultItems(data.user);
    } catch {
      setAuthError('Server se connect nahi ho paya. Kripya check karein.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vaultUser');
    setUser(null);
    setItems([]);
    setActiveMedia(null);
    setPlayingVideo(null);
  };

  const existingFolders = Array.from(new Set(items.map(i => i.folder || 'General')));
  const finalFolderName = folderMode === 'new' ? (newFolderName.trim() || 'General') : chosenFolder;

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    if (uploadMethod === 'drive') {
      if (!driveUrl) return alert('Google Drive Link zaroori hai.');
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: driveFileName.trim() || 'Google Drive File',
            url: driveUrl.trim(),
            type: 'link/drive',
            folder: finalFolderName,
            username: user
          })
        });
        const savedItem = await res.json();
        setItems(prev => [savedItem, ...prev]);
        alert('Google Drive Link Cloud par save ho gaya!');
        setDriveUrl('');
        setDriveFileName('');
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
      return;
    }

    if (!files || files.length === 0) return alert('Pehle koi file choose karein!');

    setUploading(true);
    setProgress(30);

    try {
      let uploadFileList = [...files];

      if (uploadMethod === 'zip') {
        const zipFile = files[0];
        const jszip = new JSZip();
        const zipContent = await jszip.loadAsync(zipFile);
        uploadFileList = [];

        for (const relativePath of Object.keys(zipContent.files)) {
          const entry = zipContent.files[relativePath];
          if (entry.dir) continue;
          const fileName = entry.name.split('/').pop();
          if (!fileName || fileName.startsWith('.')) continue;

          const isImg = fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i);
          const isVid = fileName.match(/\.(mp4|mov|webm)$/i);
          if (isImg || isVid) {
            const blob = await entry.async('blob');
            const extractedFile = new File([blob], fileName, { type: isImg ? 'image/jpeg' : 'video/mp4' });
            uploadFileList.push(extractedFile);
          }
        }

        if (uploadFileList.length === 0) {
          alert('Is ZIP file me koi valid photo ya video nahi mili.');
          setUploading(false);
          return;
        }
      }

      const formData = new FormData();
      uploadFileList.forEach(file => {
        formData.append('files', file);
      });
      formData.append('folder', finalFolderName);
      formData.append('username', user);

      setProgress(60);

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const uploadedData = await res.json();

      setProgress(100);

      if (Array.isArray(uploadedData)) {
        setItems(prev => [...uploadedData, ...prev]);
        if (uploadedData[0]) setActiveMedia(uploadedData[0]);
        alert(`${uploadedData.length} files successfully cloud vault me upload ho gayi!`);
      } else {
        setItems(prev => [uploadedData, ...prev]);
        if (uploadedData) setActiveMedia(uploadedData);
      }

      setFiles([]);
      setNewFolderName('');
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    return `${SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Direct Blob Download with proper extension fallback
  const handleDirectDownload = async (item) => {
    try {
      const fileUrl = getMediaUrl(item.url);
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('File server par nahi mili.');
      const blob = await res.blob();
      
      // Determine file extension
      let filename = item.name || 'media_vault';
      if (!filename.includes('.')) {
        const isVid = item.type?.includes('video') || item.url?.match(/\.(mp4|mov|webm)$/i);
        filename += isVid ? '.mp4' : '.jpg';
      }
      saveAs(blob, filename);
    } catch {
      alert('File load nahi ho saki ya expire ho chuki hai.');
    }
  };

  const handleDownloadZip = async (folderTarget = 'ALL') => {
    const listToZip = folderTarget === 'ALL'
      ? items.filter(i => i.type !== 'link/drive')
      : items.filter(i => (i.folder || 'General') === folderTarget && i.type !== 'link/drive');

    if (listToZip.length === 0) {
      return alert('Download ke liye koi photo/video available nahi hai.');
    }

    setZipping(true);
    const zip = new JSZip();

    try {
      for (const item of listToZip) {
        const fileUrl = getMediaUrl(item.url);
        const res = await fetch(fileUrl);
        if (res.ok) {
          const blobData = await res.blob();
          const folderName = item.folder || 'General';
          let fname = item.name || 'media';
          if (!fname.includes('.')) fname += item.type?.includes('video') ? '.mp4' : '.jpg';

          if (folderTarget === 'ALL') {
            zip.folder(folderName).file(fname, blobData);
          } else {
            zip.file(fname, blobData);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const zipFileName = folderTarget === 'ALL' ? 'vault-all-media.zip' : `${folderTarget}-media.zip`;
      saveAs(content, zipFileName);
    } catch (err) {
      alert('ZIP download failed: ' + err.message);
    }
    setZipping(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Kya aap ise vault se delete karna chahte hain?')) return;
    try {
      await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i._id !== id));
      if (activeMedia && activeMedia._id === id) setActiveMedia(null);
      if (playingVideo && playingVideo._id === id) setPlayingVideo(null);
    } catch (err) {
      alert('Delete fail: ' + err.message);
    }
  };

  // Video Player Control Handlers
  const handleSkip = (seconds) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime += seconds;
    }
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.volume = newVol;
    }
  };

  const displayedItems = (selectedFolderTab === 'ALL'
    ? items
    : items.filter(i => (i.folder || 'General') === selectedFolderTab)
  ).filter(i => (i.name || '').toLowerCase().includes(search.toLowerCase()));

  const bgMedia = activeMedia || items[0] || null;
  const isBgVideo = bgMedia && (bgMedia.type?.includes('video') || bgMedia.url?.match(/\.(mp4|mov|webm)$/i));
  const isBgPhoto = bgMedia && !isBgVideo && (bgMedia.type?.includes('image') || bgMedia.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i));

  const isDark = theme === 'dark';

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: isDark ? '#000000' : '#f8fafc',
        color: isDark ? '#ffffff' : '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '380px',
          background: isDark ? '#09090b' : '#ffffff',
          border: isDark ? '1px solid #27272a' : '1px solid #cbd5e1',
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
          borderRadius: '12px',
          padding: '30px',
          textAlign: 'center'
        }}>
          <h2 style={{ letterSpacing: '3px', fontSize: '1.4rem', marginBottom: '8px', fontWeight: '800' }}>APERTURE VAULT</h2>
          <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '0.85rem', marginBottom: '20px' }}>
            {authMode === 'login' ? 'Enter vault credentials' : 'Create new vault account'}
          </p>
          {authError && <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px' }}>{authError}</div>}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
              style={{
                background: isDark ? '#18181b' : '#f1f5f9',
                border: isDark ? '1px solid #27272a' : '1px solid #cbd5e1',
                color: isDark ? '#fff' : '#000',
                padding: '12px 14px',
                borderRadius: '6px',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              style={{
                background: isDark ? '#18181b' : '#f1f5f9',
                border: isDark ? '1px solid #27272a' : '1px solid #cbd5e1',
                color: isDark ? '#fff' : '#000',
                padding: '12px 14px',
                borderRadius: '6px',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            />
            <button type="submit" style={{
              background: isDark ? '#ffffff' : '#0f172a',
              color: isDark ? '#000000' : '#ffffff',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontWeight: '700',
              cursor: 'pointer',
              marginTop: '5px'
            }}>
              {authMode === 'login' ? 'ENTER VAULT' : 'REGISTER'}
            </button>
          </form>
          <div style={{ marginTop: '20px', fontSize: '0.85rem', color: isDark ? '#64748b' : '#94a3b8' }}>
            {authMode === 'login' ? "Naye user hain? " : "Pehle se registered hain? "}
            <span
              onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
              style={{ color: isDark ? '#fff' : '#0284c7', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {authMode === 'login' ? 'Register karein' : 'Login karein'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      backgroundColor: bgMedia ? 'transparent' : (isDark ? '#000000' : '#ffffff'),
      color: isDark ? '#ffffff' : '#0f172a',
      fontFamily: 'sans-serif',
      overflowX: 'hidden'
    }}>

      {/* Background Media Container */}
      {bgMedia && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {isBgVideo ? (
            <video
              key={bgMedia.url}
              src={getMediaUrl(bgMedia.url)}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: isDark ? 'brightness(0.35)' : 'brightness(0.85)'
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${getMediaUrl(bgMedia.url)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: isDark ? 'brightness(0.35)' : 'brightness(0.9)'
              }}
            />
          )}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: isDark
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.85) 100%)'
              : 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.6) 100%)'
          }} />
        </div>
      )}

      {/* Video Modal Player (Full Screen ya Small Window) */}
      {playingVideo && (
        <div style={{
          position: 'fixed',
          zIndex: 9999,
          ...(playerSize === 'full' ? {
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          } : {
            bottom: '20px',
            right: '20px',
            width: '380px',
            background: isDark ? '#18181b' : '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          })
        }}>
          {/* Header Controls */}
          <div style={{ width: playerSize === 'full' ? '90%' : '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: '700', fontSize: '0.9rem', color: playerSize === 'full' || isDark ? '#fff' : '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🎥 {playingVideo.name || 'Video Player'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPlayerSize(prev => prev === 'full' ? 'small' : 'full')}
                style={{ background: '#38bdf8', color: '#000', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
              >
                {playerSize === 'full' ? '🗗 Small' : '🗖 Full'}
              </button>
              <button
                onClick={() => setPlayingVideo(null)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div style={{ position: 'relative', width: playerSize === 'full' ? '90%' : '100%', maxWidth: playerSize === 'full' ? '900px' : 'none', maxHeight: playerSize === 'full' ? '70vh' : '220px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
            <video
              ref={videoPlayerRef}
              src={getMediaUrl(playingVideo.url)}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', maxHeight: playerSize === 'full' ? '70vh' : '220px', objectFit: 'contain' }}
            />
          </div>

          {/* Extra Custom Controllers: 10s Backward / Forward & Volume */}
          <div style={{ width: playerSize === 'full' ? '90%' : '100%', maxWidth: '900px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
            <button
              onClick={() => handleSkip(-10)}
              style={{ background: isDark || playerSize === 'full' ? 'rgba(255,255,255,0.15)' : '#e2e8f0', color: playerSize === 'full' || isDark ? '#fff' : '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
            >
              ⏪ -10s
            </button>
            <button
              onClick={() => handleSkip(10)}
              style={{ background: isDark || playerSize === 'full' ? 'rgba(255,255,255,0.15)' : '#e2e8f0', color: playerSize === 'full' || isDark ? '#fff' : '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
            >
              +10s ⏩
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: playerSize === 'full' || isDark ? '#fff' : '#000' }}>🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                style={{ width: '80px', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Foreground Content */}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '0 auto', padding: '20px 25px 80px' }}>

        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '20px',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: '800', letterSpacing: '2px' }}>APERTURE</div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button
              onClick={toggleTheme}
              style={{
                background: isDark ? '#1e293b' : '#ffffff',
                border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                color: isDark ? '#f8fafc' : '#0f172a',
                padding: '8px 16px',
                borderRadius: '24px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.85rem'
              }}
            >
              {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>

            <span style={{ fontSize: '0.85rem', color: isDark ? '#cbd5e1' : '#0f172a' }}>
              Vault: <strong>{user}</strong>
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: isDark ? 'transparent' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid #cbd5e1',
                color: isDark ? '#fff' : '#0f172a',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              LOG OUT
            </button>
          </div>
        </nav>

        <div style={{ textAlign: 'center', padding: '40px 10px 30px' }}>
          <h1 style={{ fontSize: '2.6rem', fontWeight: '800', letterSpacing: '-1px', marginBottom: '10px' }}>
            Your Cinematic Media Cloud
          </h1>
          <p style={{ color: isDark ? '#cbd5e1' : '#334155', maxWidth: '600px', margin: '0 auto 25px', fontSize: '0.95rem' }}>
            Raw 4K videos aur high-res photography upload karein, organize karein aur background cinematic mode set karein.
          </p>

          <div style={{
            background: isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(14px)',
            padding: '20px',
            borderRadius: '12px',
            border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            maxWidth: '780px',
            margin: '0 auto',
            textAlign: 'left'
          }}>
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b' }}>Upload Method:</span>
                {['single', 'multiple', 'zip', 'drive'].map(m => (
                  <label key={m} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#334155' }}>
                    <input
                      type="radio"
                      name="method"
                      checked={uploadMethod === m}
                      onChange={() => setUploadMethod(m)}
                    />
                    {m === 'single' ? 'One by One' : m === 'multiple' ? 'Multi Files' : m === 'zip' ? '📦 Upload ZIP' : 'Google Drive'}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b' }}>Target Folder:</span>
                  <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#334155' }}>
                    <input
                      type="radio"
                      name="fMode"
                      checked={folderMode === 'new'}
                      onChange={() => setFolderMode('new')}
                    /> + Create New Folder
                  </label>
                  {existingFolders.length > 0 && (
                    <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#334155' }}>
                      <input
                        type="radio"
                        name="fMode"
                        checked={folderMode === 'existing'}
                        onChange={() => setFolderMode('existing')}
                      /> Existing Folder
                    </label>
                  )}
                </div>

                {folderMode === 'new' ? (
                  <input
                    type="text"
                    placeholder="Folder Name likhein"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
                      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1',
                      color: isDark ? '#fff' : '#000',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                    required
                  />
                ) : (
                  <select
                    value={chosenFolder}
                    onChange={(e) => setChosenFolder(e.target.value)}
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
                      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1',
                      color: isDark ? '#fff' : '#000',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  >
                    {existingFolders.map((f, i) => (
                      <option key={i} value={f}>📁 {f}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {uploadMethod === 'drive' ? (
                  <>
                    <input
                      type="text"
                      placeholder="File Name"
                      value={driveFileName}
                      onChange={(e) => setDriveFileName(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1', background: isDark ? 'rgba(0,0,0,0.6)' : '#ffffff', color: isDark ? '#fff' : '#000' }}
                      required
                    />
                    <input
                      type="url"
                      placeholder="Google Drive URL"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      style={{ flex: 2, padding: '8px 12px', borderRadius: '6px', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1', background: isDark ? 'rgba(0,0,0,0.6)' : '#ffffff', color: isDark ? '#fff' : '#000' }}
                      required
                    />
                  </>
                ) : (
                  <input
                    type="file"
                    accept={uploadMethod === 'zip' ? '.zip,.rar,.7z' : 'video/*,image/*'}
                    multiple={uploadMethod === 'multiple'}
                    onChange={(e) => setFiles(Array.from(e.target.files))}
                    required
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1', background: isDark ? 'rgba(0,0,0,0.6)' : '#ffffff', color: isDark ? '#fff' : '#000' }}
                  />
                )}
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    background: isDark ? '#38bdf8' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: '6px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {uploading ? `Uploading ${progress}%` : uploadMethod === 'zip' ? 'Extract & Add ZIP' : 'Upload Now'}
                </button>
              </div>
            </form>

            {uploading && (
              <div style={{ height: '6px', background: isDark ? 'rgba(255,255,255,0.2)' : '#e2e8f0', borderRadius: '3px', marginTop: '15px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#38bdf8', width: `${progress}%`, transition: 'width 0.2s' }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', margin: '30px 0 20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search uploaded video or photo by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: '260px',
              padding: '12px 16px',
              background: isDark ? 'rgba(24, 24, 27, 0.7)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(8px)',
              border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #cbd5e1',
              color: isDark ? '#fff' : '#000',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
          <button
            onClick={() => handleDownloadZip('ALL')}
            disabled={zipping}
            style={{
              background: '#22c55e',
              color: '#000000',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📦 {zipping ? 'Zipping...' : 'Download All (.ZIP)'}
          </button>
        </div>

        <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedFolderTab('ALL')}
              style={{
                border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #cbd5e1',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                background: selectedFolderTab === 'ALL' ? '#38bdf8' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'),
                color: selectedFolderTab === 'ALL' ? '#000' : (isDark ? '#fff' : '#000')
              }}
            >
              All Files ({items.length})
            </button>
            {existingFolders.map((f, i) => (
              <button
                key={i}
                onClick={() => setSelectedFolderTab(f)}
                style={{
                  border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: selectedFolderTab === f ? '#38bdf8' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)'),
                  color: selectedFolderTab === f ? '#000' : (isDark ? '#fff' : '#000')
                }}
              >
                📁 {f} ({items.filter(it => (it.folder || 'General') === f).length})
              </button>
            ))}
          </div>

          {selectedFolderTab !== 'ALL' && (
            <button
              onClick={() => handleDownloadZip(selectedFolderTab)}
              disabled={zipping}
              style={{
                background: '#38bdf8',
                color: '#000',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📥 Download "{selectedFolderTab}" as .ZIP
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {displayedItems.length === 0 ? (
            <div style={{ color: isDark ? '#94a3b8' : '#64748b', gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              Is folder me koi media nahi mila.
            </div>
          ) : (
            displayedItems.map((item) => {
              const itemIsVideo = item.type?.includes('video') || item.url?.match(/\.(mp4|mov|webm)$/i);
              const itemIsDrive = item.type === 'link/drive';
              const isCurrentlyActive = (activeMedia && activeMedia._id === item._id) || (!activeMedia && bgMedia && bgMedia._id === item._id);

              return (
                <div
                  key={item._id}
                  style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: isCurrentlyActive
                      ? '2px solid #38bdf8'
                      : (isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)'),
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div
                    style={{ position: 'relative', height: '160px', background: '#09090b', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => !itemIsDrive && setActiveMedia(item)}
                  >
                    {itemIsDrive ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '2.5rem' }}>📁</span>
                        <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Drive Link</span>
                      </div>
                    ) : itemIsVideo ? (
                      <video src={getMediaUrl(item.url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <img src={getMediaUrl(item.url)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}

                    {!itemIsDrive && (
                      <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', color: '#38bdf8' }}>
                        {isCurrentlyActive ? '● Background Active' : '▶ Set Background'}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isDark ? '#fff' : '#0f172a' }}>
                      {item.name || 'Untitled File'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                      Folder: <strong>{item.folder || 'General'}</strong>
                    </div>
                    
                    {/* Action buttons: Play, Download, Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f1f5f9', paddingTop: '8px', gap: '8px' }}>
                      {itemIsVideo && (
                        <button
                          onClick={() => setPlayingVideo(item)}
                          style={{ background: '#38bdf8', color: '#000', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          ▶ Play
                        </button>
                      )}

                      {itemIsDrive ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', textDecoration: 'none' }}>
                          Open Drive ↗
                        </a>
                      ) : (
                        <button onClick={() => handleDirectDownload(item)} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                          Download
                        </button>
                      )}

                      <button onClick={() => handleDelete(item._id)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}