'use client';

import { ArrowLeft, Layers, ListVideo, Loader2, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { savePlayRecord } from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import TVNativeVideo from '@/components/tv/player/TVNativeVideo';
import { fetchTVDetail, formatTVTime, resolveTVEpisodeUrl } from '@/components/tv/player/utils';
import TVVirtualRemote from '@/components/tv/TVVirtualRemote';

function TVPlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [toggleCommand, setToggleCommand] = useState(0);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const timeRef = useRef({ current: 0, duration: 0 });

  const source = searchParams.get('source');
  const id = searchParams.get('id');
  const title = searchParams.get('title');
  const fileName = searchParams.get('fileName');
  const initialIndex = Number(searchParams.get('index') || '0');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchTVDetail({ source, id, title, fileName })
      .then((data) => {
        if (!alive) return;
        setDetail(data.detail);
        setSources(data.sources);
        const safeIndex = Math.max(0, Math.min(initialIndex || data.detail.initialEpisodeIndex || 0, Math.max(0, (data.detail.episodes?.length || 1) - 1)));
        setEpisodeIndex(safeIndex);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : '加载播放信息失败'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [source, id, title, fileName, initialIndex]);

  useEffect(() => {
    let alive = true;
    async function resolve() {
      if (!detail?.episodes?.[episodeIndex]) return;
      setResolving(true);
      setVideoUrl('');
      try {
        const url = await resolveTVEpisodeUrl(detail.episodes[episodeIndex], detail.source, detail.proxyMode);
        if (alive) setVideoUrl(url);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : '获取播放地址失败');
      } finally {
        if (alive) setResolving(false);
      }
    }
    resolve();
    return () => { alive = false; };
  }, [detail, episodeIndex]);

  const episodeTitle = useMemo(() => detail?.episodes_titles?.[episodeIndex] || `第 ${episodeIndex + 1} 集`, [detail, episodeIndex]);

  const onTime = useCallback((current: number, duration: number) => {
    const next = { current, duration };
    timeRef.current = next;
    setTime(next);
  }, []);

  useEffect(() => {
    if (!detail) return;
    const timer = window.setInterval(() => {
      savePlayRecord(detail.source, detail.id, {
        title: detail.title,
        source_name: detail.source_name,
        year: detail.year || '',
        cover: detail.poster || '',
        index: episodeIndex + 1,
        total_episodes: detail.episodes?.length || 1,
        play_time: Math.floor(timeRef.current.current || 0),
        total_time: Math.floor(timeRef.current.duration || 0),
        save_time: Date.now(),
        search_title: title || detail.title,
      }).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [detail, episodeIndex, title]);

  const switchEpisode = (next: number) => {
    if (!detail) return;
    const max = detail.episodes.length - 1;
    setEpisodeIndex(Math.max(0, Math.min(max, next)));
    setShowPanel(true);
  };

  const switchSource = async (item: SearchResult) => {
    setShowPanel(true);
    setShowEpisodes(false);
    setLoading(true);
    try {
      let next = item;
      if (!item.episodes?.length) {
        const data = await fetchTVDetail({ source: item.source, id: item.id, title: item.title });
        next = data.detail;
      }
      setDetail(next);
      setEpisodeIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换播放源失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const active = document.activeElement;
        const isControlFocused = active instanceof HTMLElement && Boolean(active.closest('[data-tv-player-control]'));
        if (!showPanel && !showEpisodes) {
          event.preventDefault();
          setToggleCommand((value) => value + 1);
          return;
        }
        if (!isControlFocused) {
          event.preventDefault();
          if (showEpisodes) {
            setShowEpisodes(false);
          } else {
            setShowPanel(false);
          }
        }
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (!showPanel && !showEpisodes) {
          setShowPanel(true);
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showEpisodes) setShowEpisodes(false);
        else if (showPanel) setShowPanel(false);
        else router.back();
      }
      if (event.key === 'PageUp') switchEpisode(episodeIndex - 1);
      if (event.key === 'PageDown') switchEpisode(episodeIndex + 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [episodeIndex, router, showEpisodes, showPanel]);

  if (loading) {
    return <main className='fixed inset-0 flex items-center justify-center bg-black text-3xl font-bold text-white'><Loader2 className='mr-4 h-10 w-10 animate-spin text-rose-500' />正在进入电视播放...</main>;
  }

  if (error || !detail) {
    return <main className='fixed inset-0 flex items-center justify-center bg-black p-10 text-center text-3xl font-black text-red-100'>{error || '播放信息不存在'}</main>;
  }

  return (
    <main data-tv-player-root className='fixed inset-0 overflow-hidden bg-black text-white' onMouseMove={() => setShowPanel(true)}>
      {videoUrl ? <TVNativeVideo url={videoUrl} poster={detail.poster} title={detail.title} onTime={onTime} command={toggleCommand} /> : (
        <div className='flex h-full w-full items-center justify-center text-3xl font-bold text-white'><Loader2 className='mr-4 h-10 w-10 animate-spin text-rose-500' />{resolving ? '正在解析播放地址...' : '准备播放...'}</div>
      )}

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showPanel ? 'opacity-100' : 'opacity-0'}`}>
        <div className='absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 to-transparent' />
        <div className='absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/95 to-transparent' />
      </div>

      <div className={`absolute left-8 right-8 top-8 flex items-center justify-between transition-opacity duration-300 ${showPanel ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={() => router.back()} data-tv-player-control className='tv-focusable flex cursor-pointer items-center gap-3 rounded-2xl bg-black/70 px-5 py-4 text-2xl font-black outline-none backdrop-blur'><ArrowLeft className='h-7 w-7' />返回</button>
        <div className='rounded-2xl bg-black/70 px-6 py-4 text-right backdrop-blur'>
          <div className='max-w-[60vw] truncate text-3xl font-black'>{detail.title}</div>
          <div className='mt-1 text-xl text-slate-300'>{episodeTitle} · {detail.source_name}</div>
        </div>
      </div>

      <div data-tv-player-control className={`absolute bottom-8 left-8 right-8 transition-opacity duration-300 ${showPanel ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className='mb-5 h-2 overflow-hidden rounded-full bg-white/20'>
          <div className='h-full rounded-full bg-rose-600' style={{ width: time.duration ? `${Math.min(100, (time.current / time.duration) * 100)}%` : '0%' }} />
        </div>
        <div className='flex items-center justify-between gap-5 rounded-[28px] bg-black/75 p-4 backdrop-blur'>
          <div className='flex items-center gap-3'>
            <button onClick={() => switchEpisode(episodeIndex - 1)} data-tv-player-control className='tv-focusable flex cursor-pointer items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-xl font-bold outline-none'><SkipBack className='h-6 w-6' />上一集</button>
            <button onClick={() => setShowPanel(false)} data-tv-player-control className='tv-focusable flex cursor-pointer items-center gap-2 rounded-2xl bg-rose-600 px-6 py-4 text-xl font-black outline-none'><Pause className='h-6 w-6' />隐藏</button>
            <button onClick={() => switchEpisode(episodeIndex + 1)} data-tv-player-control className='tv-focusable flex cursor-pointer items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-xl font-bold outline-none'>下一集<SkipForward className='h-6 w-6' /></button>
            <button onClick={() => setShowEpisodes((v) => !v)} data-tv-player-control className='tv-focusable flex cursor-pointer items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-xl font-bold outline-none'><ListVideo className='h-6 w-6' />选集</button>
          </div>
          <div className='text-xl font-bold text-slate-200'>{formatTVTime(time.current)} / {formatTVTime(time.duration)}</div>
        </div>
      </div>

      {showEpisodes && (
        <aside className='absolute bottom-40 right-8 max-h-[55vh] w-[560px] overflow-y-auto rounded-[34px] border border-white/10 bg-slate-950/92 p-6 shadow-2xl shadow-black/70 backdrop-blur-2xl'>
          <h2 className='mb-5 flex items-center gap-3 text-3xl font-black'><Layers className='h-8 w-8 text-rose-500' />选集与线路</h2>
          {sources.length > 1 && <div className='mb-6 flex gap-3 overflow-x-auto px-2 py-3 [scrollbar-width:none]'>{sources.map((item) => <button key={`${item.source}-${item.id}`} onClick={() => switchSource(item)} data-tv-player-control className={`tv-focusable cursor-pointer rounded-2xl px-5 py-3 text-xl font-bold outline-none ${detail.source === item.source && detail.id === item.id ? 'bg-rose-600' : 'bg-white/10'}`}>{item.source_name || item.source}</button>)}</div>}
          <div className='grid grid-cols-4 gap-3'>
            {detail.episodes.map((_, index) => <button key={index} onClick={() => switchEpisode(index)} data-tv-player-control className={`tv-focusable min-h-16 cursor-pointer rounded-2xl px-3 py-3 text-lg font-black outline-none ${index === episodeIndex ? 'bg-rose-600' : 'bg-white/10'}`}>{detail.episodes_titles?.[index] || `第 ${index + 1} 集`}</button>)}
          </div>
        </aside>
      )}
      <TVVirtualRemote />
    </main>
  );
}

export default function TVPlayPage() {
  return <Suspense fallback={null}><TVPlayClient /></Suspense>;
}
