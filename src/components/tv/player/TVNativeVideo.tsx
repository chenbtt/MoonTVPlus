'use client';

import { Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface HTMLVideoElement {
    hls?: any;
    flv?: any;
  }
}

function getSourceType(url: string): 'm3u8' | 'flv' | 'native' {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.includes('.m3u8') || lower.includes('.m3u')) return 'm3u8';
  if (lower.endsWith('.flv') || url.toLowerCase().includes('.flv?')) return 'flv';
  return 'native';
}

export default function TVNativeVideo({
  url,
  poster,
  live = false,
  title,
  onTime,
  command,
  className = '',
}: {
  url: string;
  poster?: string;
  live?: boolean;
  title?: string;
  onTime?: (current: number, duration: number) => void;
  command?: number;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const videoEl = video;

    let disposed = false;
    setLoading(true);
    setError('');
    setPlaying(false);

    const cleanup = () => {
      if (videoEl.hls) {
        videoEl.hls.destroy();
        videoEl.hls = null;
      }
      if (videoEl.flv) {
        videoEl.flv.destroy();
        videoEl.flv = null;
      }
      videoEl.removeAttribute('src');
      videoEl.load();
    };

    const playSafely = () => {
      videoEl.play().catch(() => {
        // 浏览器阻止自动播放时，等待用户按 OK/点击播放
      });
    };

    async function attach() {
      cleanup();
      const type = getSourceType(url);

      try {
        if (type === 'm3u8' && !videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          const HlsModule = await import('hls.js');
          if (disposed) return;
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: live,
              backBufferLength: live ? 10 : 30,
              maxBufferLength: live ? 18 : 45,
            });
            hls.loadSource(url);
            hls.attachMedia(videoEl);
            videoEl.hls = hls;
          } else {
            videoEl.src = url;
          }
        } else if (type === 'flv') {
          const flvModule = await import('flv.js');
          if (disposed) return;
          const flvjs = flvModule.default;
          if (flvjs.isSupported()) {
            const flv = flvjs.createPlayer({ type: 'flv', url, isLive: live });
            flv.attachMediaElement(videoEl);
            flv.load();
            videoEl.flv = flv;
          } else {
            videoEl.src = url;
          }
        } else {
          videoEl.src = url;
        }

        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.muted = false;
        playSafely();
      } catch (err) {
        console.error('[TVNativeVideo] attach failed:', err);
        setError('播放器初始化失败');
        setLoading(false);
      }
    }

    attach();

    const onLoaded = () => setLoading(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setLoading(false);
      setError('视频加载失败，请尝试切换线路或频道');
    };
    const onTimeUpdate = () => onTime?.(videoEl.currentTime || 0, videoEl.duration || 0);

    videoEl.addEventListener('loadeddata', onLoaded);
    videoEl.addEventListener('canplay', onLoaded);
    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('error', onError);
    videoEl.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      disposed = true;
      videoEl.removeEventListener('loadeddata', onLoaded);
      videoEl.removeEventListener('canplay', onLoaded);
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('error', onError);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      cleanup();
    };
  }, [url, live, onTime]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  useEffect(() => {
    if (command) toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <video
        ref={videoRef}
        poster={poster}
        className='h-full w-full bg-black object-contain'
        controls={false}
        playsInline
        preload='auto'
        onClick={toggle}
        aria-label={title || 'TV 视频播放器'}
      />
      {loading && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-2xl font-bold text-white'>
          <Loader2 className='mr-3 h-9 w-9 animate-spin text-rose-500' /> 正在缓冲...
        </div>
      )}
      {error && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/70 p-8 text-center text-3xl font-black text-white'>
          {error}
        </div>
      )}
      <button
        type='button'
        onClick={toggle}
        className='tv-focusable absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/35 text-white opacity-0 outline-none backdrop-blur transition hover:opacity-100 focus:opacity-100'
        aria-label={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause className='h-12 w-12' /> : <Play className='h-12 w-12 fill-current' />}
      </button>
    </div>
  );
}
