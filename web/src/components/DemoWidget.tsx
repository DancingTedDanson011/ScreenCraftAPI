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

export default function DemoWidget({ apiEndpoint = 'http://localhost:3000' }: DemoWidgetProps) {
  const [url, setUrl] = useState('https://github.com');
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);

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

    // Validate inputs
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL');
      return;
    }

    if (width < 320 || width > 3840) {
      setError('Width must be between 320 and 3840 pixels');
      return;
    }

    if (height < 240 || height > 2160) {
      setError('Height must be between 240 and 2160 pixels');
      return;
    }

    setLoading(true);

    try {
      const startTime = Date.now();

      // Build query parameters
      const params = new URLSearchParams({
        url: url.trim(),
        format,
        width: width.toString(),
        height: height.toString(),
      });

      // Build the full API URL - apiEndpoint already contains /api
      const baseUrl = apiEndpoint.endsWith('/api') ? apiEndpoint : `${apiEndpoint}/api`;
      const response = await fetch(`${baseUrl}/v1/demo/screenshot?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const duration = (Date.now() - startTime) / 1000;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is JSON (with metadata) or direct image
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();

        // Assume API returns { imageUrl, metadata } or { imageBase64, metadata }
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
        // Direct image response
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

    } catch (err) {
      console.error('Screenshot generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate screenshot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageData) return;

    const link = document.createElement('a');
    link.href = imageData;
    link.download = `screenshot-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <h3 className="text-lg font-semibold text-[#F0F6FC] mb-4">
        Try it now (No signup required)
      </h3>

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

      {/* Format and Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm text-[#8B949E] mb-2">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
            disabled={loading}
            className="w-full px-4 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] focus:border-[#1F6FEB] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-[#8B949E] mb-2">Width (px)</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value) || 1920)}
            min="320"
            max="3840"
            disabled={loading}
            className="w-full px-4 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] focus:border-[#1F6FEB] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm text-[#8B949E] mb-2">Height (px)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(parseInt(e.target.value) || 1080)}
            min="240"
            max="2160"
            disabled={loading}
            className="w-full px-4 py-2 bg-[#161B22] border border-[#30363D] rounded-lg text-[#F0F6FC] focus:border-[#1F6FEB] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full px-6 py-3 bg-gradient-to-r from-[#238636] to-[#2EA043] text-white font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(35,134,54,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Generate Screenshot
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
      {loading && !imageData && (
        <div className="mt-6 bg-[#161B22] border border-[#30363D] rounded-lg p-4 min-h-[300px] flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-4 animate-pulse">
            <div className="h-4 bg-[#30363D] rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-[#30363D] rounded w-1/2 mx-auto"></div>
            <div className="h-48 bg-[#30363D] rounded"></div>
          </div>
        </div>
      )}

      {/* Result Preview */}
      {imageData && result && (
        <div className="mt-6 space-y-4">
          {/* Image Preview */}
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
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-[#238636]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-[#238636] font-medium">Success</span>
              </span>
              <span>•</span>
              <span>Time: <span className="text-[#F0F6FC] font-medium">{result.duration.toFixed(2)}s</span></span>
              <span>•</span>
              <span>Size: <span className="text-[#F0F6FC] font-medium">{formatBytes(result.size)}</span></span>
              <span>•</span>
              <span>Dimensions: <span className="text-[#F0F6FC] font-medium">{result.width}x{result.height}</span></span>
              <span>•</span>
              <span>Format: <span className="text-[#F0F6FC] font-medium uppercase">{result.format}</span></span>
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

      {/* Rate Limit Info */}
      <div className="mt-4 text-xs text-[#6E7681] text-center">
        Demo limited to 10 requests per minute • No authentication required
      </div>
    </div>
  );
}
