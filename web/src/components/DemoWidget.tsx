import { useState } from 'react';

interface DemoWidgetProps {
  apiEndpoint?: string;
}

interface ScreenshotResult {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  duration: number;
}

type DemoMode = 'screenshot' | 'pdf';

// Get dynamic API URL based on current location
function getApiUrl(endpoint: string): string {
  if (endpoint) return endpoint;
  if (typeof window === 'undefined') return 'http://localhost:3000';
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : `${window.location.protocol}//${window.location.hostname}`;
}

export default function DemoWidget({ apiEndpoint = '' }: DemoWidgetProps) {
  // Mode toggle
  const [mode, setMode] = useState<DemoMode>('screenshot');

  // Common options
  const [url, setUrl] = useState('https://youtube.com');

  // Screenshot options
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fullPage, setFullPage] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [delay, setDelay] = useState(0);
  const [quality, setQuality] = useState(90);
  const [acceptCookies, setAcceptCookies] = useState(true);

  // PDF options
  const [pdfFormat, setPdfFormat] = useState<'A4' | 'Letter' | 'Legal'>('A4');
  const [landscape, setLandscape] = useState(false);

  // Show advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const validateUrl = (inputUrl: string): boolean => {
    try {
      const parsed = new URL(inputUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleGenerate = async () => {
    // Reset state
    setError(null);
    setResult(null);
    setImageData(null);
    setPdfUrl(null);

    // Validate inputs
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL');
      return;
    }

    if (mode === 'screenshot') {
      if (width < 320 || width > 3840) {
        setError('Width must be between 320 and 3840 pixels');
        return;
      }
      if (height < 240 || height > 2160) {
        setError('Height must be between 240 and 2160 pixels');
        return;
      }
      if (scrollY > 0 && fullPage) {
        setError('Cannot use scroll position with full page capture');
        return;
      }
    }

    setLoading(true);

    try {
      const startTime = Date.now();
      const resolvedEndpoint = getApiUrl(apiEndpoint);
      const baseUrl = resolvedEndpoint.endsWith('/api') ? resolvedEndpoint : `${resolvedEndpoint}/api`;

      if (mode === 'screenshot') {
        // Build screenshot query parameters
        const params = new URLSearchParams({
          url: url.trim(),
          format,
          width: width.toString(),
          height: height.toString(),
        });

        if (fullPage) params.append('fullPage', 'true');
        if (scrollY > 0 && !fullPage) params.append('scrollY', scrollY.toString());
        if (delay > 0) params.append('delay', delay.toString());
        if (format === 'jpeg' && quality < 100) params.append('quality', quality.toString());
        if (!acceptCookies) params.append('acceptCookies', 'false');

        const response = await fetch(`${baseUrl}/v1/demo/screenshot?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        const duration = (Date.now() - startTime) / 1000;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.imageBase64) {
            setImageData(`data:image/${format};base64,${data.imageBase64}`);
          } else if (data.imageUrl) {
            setImageData(data.imageUrl);
          }
          setResult({
            url: url.trim(),
            width: data.width || width,
            height: data.height || height,
            format: data.format || format,
            size: data.size || 0,
            duration: data.duration || duration,
          });
        } else if (contentType.includes('image/')) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          setImageData(objectUrl);
          setResult({
            url: url.trim(),
            width,
            height,
            format,
            size: blob.size,
            duration,
          });
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        // PDF generation
        const params = new URLSearchParams({
          url: url.trim(),
          format: pdfFormat,
          landscape: landscape.toString(),
        });

        if (delay > 0) params.append('delay', delay.toString());

        const response = await fetch(`${baseUrl}/v1/demo/pdf?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/pdf' },
        });

        const duration = (Date.now() - startTime) / 1000;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setResult({
          url: url.trim(),
          width: 0,
          height: 0,
          format: 'pdf',
          size: blob.size,
          duration,
        });
      }

    } catch (err) {
      console.error('Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (mode === 'screenshot' && imageData) {
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `screenshot-${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (mode === 'pdf' && pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `document-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6 shadow-lg">
      <p className="text-lg font-semibold text-[#F0F6FC] mb-4">
        Try it now (No signup required)
      </p>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4 p-1 bg-[#161B22] rounded-lg">
        <button
          onClick={() => { setMode('screenshot'); setResult(null); setImageData(null); setPdfUrl(null); }}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'screenshot'
              ? 'bg-[#238636] text-white'
              : 'text-[#8B949E] hover:text-[#F0F6FC]'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Screenshot
          </span>
        </button>
        <button
          onClick={() => { setMode('pdf'); setResult(null); setImageData(null); setPdfUrl(null); }}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'pdf'
              ? 'bg-[#238636] text-white'
              : 'text-[#8B949E] hover:text-[#F0F6FC]'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </span>
        </button>
      </div>

      {/* URL Input */}
      <div className="mb-4">
        <label className="block text-sm text-[#8B949E] mb-2">
          URL <span className="text-[#F85149]">*</span>
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          disabled={loading}
          className="w-full px-4 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] placeholder-[#6E7681] focus:border-[#1F6FEB] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Screenshot Options */}
      {mode === 'screenshot' && (
        <>
          {/* Basic Options Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label htmlFor="demo-format" className="block text-xs text-[#8B949E] mb-1">Format</label>
              <select
                id="demo-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </div>
            <div>
              <label htmlFor="demo-width" className="block text-xs text-[#8B949E] mb-1">Width</label>
              <input
                id="demo-width"
                type="number"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 1920)}
                min="320"
                max="3840"
                disabled={loading}
                className="w-full px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="demo-height" className="block text-xs text-[#8B949E] mb-1">Height</label>
              <input
                id="demo-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 1080)}
                min="240"
                max="2160"
                disabled={loading}
                className="w-full px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg w-full">
                <input
                  type="checkbox"
                  checked={fullPage}
                  onChange={(e) => {
                    setFullPage(e.target.checked);
                    if (e.target.checked) setScrollY(0);
                  }}
                  disabled={loading}
                  className="w-4 h-4 rounded border-[#30363D] bg-[#0D1117] text-[#238636] focus:ring-[#238636]"
                />
                <span className="text-sm text-[#F0F6FC]">Full Page</span>
              </label>
            </div>
          </div>

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#F0F6FC] mb-3 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-3 bg-[#161B22] rounded-lg border border-[#30363D]">
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">
                  Scroll Position (px)
                  {fullPage && <span className="text-[#F85149] ml-1">(disabled with Full Page)</span>}
                </label>
                <input
                  type="number"
                  value={scrollY}
                  onChange={(e) => setScrollY(parseInt(e.target.value) || 0)}
                  min="0"
                  max="50000"
                  disabled={loading || fullPage}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B949E] mb-1">Delay after load (ms)</label>
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                  min="0"
                  max="10000"
                  step="100"
                  disabled={loading}
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
                />
              </div>
              {format === 'jpeg' && (
                <div>
                  <label className="block text-xs text-[#8B949E] mb-1">Quality (1-100)</label>
                  <input
                    type="number"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value) || 90)}
                    min="1"
                    max="100"
                    disabled={loading}
                    className="w-full px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
                  />
                </div>
              )}
              <div className="flex items-end md:col-span-3">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg">
                  <input
                    type="checkbox"
                    checked={acceptCookies}
                    onChange={(e) => setAcceptCookies(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded border-[#30363D] bg-[#0D1117] text-[#238636] focus:ring-[#238636]"
                  />
                  <span className="text-sm text-[#F0F6FC]">Auto-accept cookies</span>
                  <span className="text-xs text-[#8B949E]">(removes cookie banners)</span>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {/* PDF Options */}
      {mode === 'pdf' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label htmlFor="demo-paper-size" className="block text-xs text-[#8B949E] mb-1">Paper Size</label>
            <select
              id="demo-paper-size"
              value={pdfFormat}
              onChange={(e) => setPdfFormat(e.target.value as 'A4' | 'Letter' | 'Legal')}
              disabled={loading}
              className="w-full px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg w-full">
              <input
                type="checkbox"
                checked={landscape}
                onChange={(e) => setLandscape(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-[#30363D] bg-[#0D1117] text-[#238636] focus:ring-[#238636]"
              />
              <span className="text-sm text-[#F0F6FC]">Landscape</span>
            </label>
          </div>
          <div>
            <label htmlFor="demo-pdf-delay" className="block text-xs text-[#8B949E] mb-1">Delay (ms)</label>
            <input
              id="demo-pdf-delay"
              type="number"
              value={delay}
              onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
              min="0"
              max="10000"
              step="100"
              disabled={loading}
              className="w-full px-3 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] text-sm focus:border-[#1F6FEB] focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full px-6 py-3 bg-gradient-to-r from-[#238636] to-[#2EA043] text-white font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(35,134,54,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating...
          </>
        ) : (
          <>
            {mode === 'screenshot' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
            Generate {mode === 'screenshot' ? 'Screenshot' : 'PDF'}
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-[#F85149]/10 border border-[#F85149]/20 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-[#F85149] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-[#F85149] text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !imageData && !pdfUrl && (
        <div className="mt-6 bg-[#161B22] border border-[#30363D] rounded-lg p-4 min-h-[200px] flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-4 animate-pulse">
            <div className="h-4 bg-[#30363D] rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-[#30363D] rounded w-1/2 mx-auto"></div>
            <div className="h-32 bg-[#30363D] rounded"></div>
          </div>
        </div>
      )}

      {/* Screenshot Result Preview */}
      {imageData && result && mode === 'screenshot' && (
        <div className="mt-6 space-y-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 overflow-hidden">
            <div className="relative group">
              <img
                src={imageData}
                alt="Screenshot preview"
                className="w-full h-auto rounded-lg border border-[#30363D] transition-transform duration-200 hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-center pb-4">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-[#238636] text-white font-medium rounded-lg hover:bg-[#2EA043] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#8B949E] bg-[#161B22] border border-[#30363D] rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-[#3FB950]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[#3FB950] font-medium">{result.duration.toFixed(2)}s</span>
              </span>
              <span className="text-[#30363D]">|</span>
              <span>{formatBytes(result.size)}</span>
              <span className="text-[#30363D]">|</span>
              <span>{result.width}x{result.height}</span>
              <span className="text-[#30363D]">|</span>
              <span className="uppercase">{result.format}</span>
              {fullPage && (
                <>
                  <span className="text-[#30363D]">|</span>
                  <span className="text-[#1F6FEB]">Full Page</span>
                </>
              )}
              {scrollY > 0 && (
                <>
                  <span className="text-[#30363D]">|</span>
                  <span className="text-[#1F6FEB]">Scroll: {scrollY}px</span>
                </>
              )}
            </div>
            <button
              onClick={handleDownload}
              className="text-[#1F6FEB] hover:text-[#58A6FF] transition-colors font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
      )}

      {/* PDF Result */}
      {pdfUrl && result && mode === 'pdf' && (
        <div className="mt-6 space-y-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 flex flex-col items-center justify-center">
            <svg className="w-16 h-16 text-[#F85149] mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1zm0 4a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1z"/>
            </svg>
            <p className="text-[#F0F6FC] font-medium mb-2">PDF Generated Successfully</p>
            <p className="text-sm text-[#8B949E] mb-4">
              {formatBytes(result.size)} | {pdfFormat} | {landscape ? 'Landscape' : 'Portrait'}
            </p>
            <div className="flex gap-3">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#21262D] text-[#F0F6FC] font-medium rounded-lg hover:bg-[#30363D] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </a>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-[#238636] text-white font-medium rounded-lg hover:bg-[#2EA043] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-center gap-4 text-xs text-[#8B949E]">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-[#3FB950]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-[#3FB950] font-medium">Generated in {result.duration.toFixed(2)}s</span>
            </span>
          </div>
        </div>
      )}

      {/* Rate Limit Info */}
      <div className="mt-4 text-xs text-[#8B949E] text-center">
        Demo limited to 10 requests per minute
      </div>
    </div>
  );
}
