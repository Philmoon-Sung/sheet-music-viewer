import { useState, useEffect, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './App.css'

// Configure worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

function App() {
  const { width: windowWidth, height: windowHeight } = useWindowSize(); // Real-time size
  const [songs, setSongs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [rotation, setRotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(null);
  const [isExtMode, setIsExtMode] = useState(false); // External Monitor Mode

  // Fetch songs on mount
  useEffect(() => {
    fetch('./songs.json')
      .then(res => res.json())
      .then(data => {
        setSongs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch songs:", err);
        setLoading(false);
      });
  }, []);

  // Filter songs
  const filteredSongs = useMemo(() => {
    if (!searchTerm) return songs;
    const lowerTerm = searchTerm.toLowerCase().replace(/\s+/g, '');
    return songs.filter(song => {
      const title = song.title.toLowerCase().replace(/\s+/g, '');
      const artist = song.artist.toLowerCase().replace(/\s+/g, '');
      return title.includes(lowerTerm) || artist.includes(lowerTerm);
    });
  }, [songs, searchTerm]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  // Retry logic
  const [retryCount, setRetryCount] = useState(0);

  // PWA Install Prompt Logic
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      // Android: Trigger the native prompt
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
      // iOS / Others: Show manual instructions
      alert("📲 앱 설치 방법\n\n[Android]\n메뉴(⋮) -> '앱 설치' 또는 '홈 화면에 추가'\n\n[iOS (iPhone)]\n공유(네모↑) 버튼 -> '홈 화면에 추가'");
    }
  };

  // Memoize PDF URL to prevent reload on resize
  const pdfUrl = useMemo(() => {
    if (!selectedSong) return null;
    return `${selectedSong.fullPath}?t=${Date.now() + retryCount}`;
  }, [selectedSong, retryCount]);

  return (
    <div className={`app-container ${isExtMode ? 'external-mode' : ''}`}>
      {/* Sticky Header */}
      <header className="header">
        <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>🎵 악보 뷰어</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isStandalone && (
              <button
                onClick={handleInstallClick}
                style={{
                  padding: '6px 12px',
                  borderRadius: '15px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  color: '#007aff'
                }}
              >
                ⬇️ 설치
              </button>
            )}
            <button
              onClick={() => setIsExtMode(!isExtMode)}
              style={{
                padding: '6px 12px',
                borderRadius: '15px',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img src="/monitor-icon.png" alt="Mode" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            </button>
          </div>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="곡명 또는 가수 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')}>X</button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="content">
        {loading ? (
          <div className="loading">로딩중...</div>
        ) : (
          <div className="song-list">
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song) => (
                <div
                  key={song.id}
                  className="song-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    // Force blur to close virtual keyboard on mobile
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                    setSelectedSong(song);
                    setRotation(null);
                    setRetryCount(0);
                  }}
                >
                  <div className="song-icon">🎼</div>
                  <div className="song-info">
                    <div className="song-title">{song.title}</div>
                    <div className="song-artist">{song.artist}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">검색 결과가 없습니다.</div>
            )}
          </div>
        )}
      </main>

      {/* PDF Overlay Modal */}
      {selectedSong && (
        <div className="pdf-modal">
          <div className="pdf-header">
            <span className="pdf-title">{selectedSong.title}</span>
            <div className="pdf-controls">
              <button
                className="ext-mode-btn"
                onClick={() => setIsExtMode(!isExtMode)}
                style={{
                  background: '#fff',
                  border: '1px solid #ccc',
                  color: '#333',
                  padding: '5px 12px',
                  borderRadius: '15px',
                  marginRight: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img src="/monitor-icon.png" alt="Mode" style={{ width: '20px', height: '20px' }} />
              </button>



              <button className="rotate-btn" onClick={() => setRotation(r => ((r || 0) + 90) % 360)}
                style={{
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '15px',
                  padding: '5px 12px',
                  marginRight: '5px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: '1'
                }}>⤵️</button>

              <button className="close-btn" onClick={() => setSelectedSong(null)}
                style={{
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '15px',
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: '1'
                }}>❌</button>
            </div>
          </div>
          <div className="pdf-body">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="pdf-msg">악보 불러오는 중...</div>}
              error={
                <div className="pdf-msg">
                  <p>PDF 로딩 실패</p>
                  <button onClick={() => setRetryCount(c => c + 1)} style={{ padding: '5px 10px', marginTop: '10px' }}>
                    🔄 다시 시도
                  </button>
                </div>
              }
              className="pdf-document"
            >
              {Array.from(new Array(numPages || 0), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  rotate={rotation === null ? undefined : rotation}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={isExtMode
                    ? windowHeight - 40 // In external mode, screen height becomes the width constraint
                    : windowWidth // Fill screen width on all devices
                  }
                />
              ))}
            </Document>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
