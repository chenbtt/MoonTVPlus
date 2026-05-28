'use client';

import { ArrowLeft, Loader2, Radio, Star } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { savePlayRecord } from '@/lib/db.client';

import TVNativeVideo from '@/components/tv/player/TVNativeVideo';
import TVVirtualRemote from '@/components/tv/TVVirtualRemote';

type LiveSource = { key: string; name: string; proxyMode?: 'full' | 'm3u8-only' | 'direct' };
type LiveChannel = { id: string; tvgId?: string; name: string; logo?: string; group?: string; url: string };

function getLogoUrl(logo?: string, source?: string) {
  if (!logo) return '';
  if (!source) return logo;
  return `/api/proxy/logo?url=${encodeURIComponent(logo)}&source=${encodeURIComponent(source)}`;
}

async function resolveLiveUrl(rawUrl: string, source?: LiveSource | null) {
  const proxyMode = source?.proxyMode || 'full';
  const lower = rawUrl.toLowerCase();
  const isM3u8 = lower.includes('.m3u8') || lower.includes('.m3u');
  if (!isM3u8 || proxyMode === 'direct') return rawUrl;
  return `/api/proxy/m3u8?url=${encodeURIComponent(rawUrl)}&moontv-source=${encodeURIComponent(source?.key || '')}`;
}

function TVLivePlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needSource = searchParams.get('source');
  const needChannel = searchParams.get('id');

  const [sources, setSources] = useState<LiveSource[]>([]);
  const [source, setSource] = useState<LiveSource | null>(null);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/live/sources')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list = data.data || [];
        setSources(list);
        const selected = list.find((s: LiveSource) => s.key === needSource) || list[0] || null;
        setSource(selected);
      })
      .catch(() => setError('获取直播源失败'));
    return () => { alive = false; };
  }, [needSource]);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/live/channels?source=${encodeURIComponent(source.key)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list = (data.data || []).map((item: any) => ({
          id: item.id,
          tvgId: item.tvgId || item.name,
          name: item.name,
          logo: item.logo,
          group: item.group || '其他',
          url: item.url,
        }));
        setChannels(list);
        const selected = list.find((c: LiveChannel) => c.id === needChannel) || list[0] || null;
        setChannel(selected);
        setSelectedGroup(selected?.group || list[0]?.group || '');
      })
      .catch(() => setError('获取频道列表失败'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [source, needChannel]);

  useEffect(() => {
    let alive = true;
    if (!channel) return;
    resolveLiveUrl(channel.url, source).then((url) => alive && setVideoUrl(url));
    if (source) {
      savePlayRecord(`live_${source.key}`, `live_${channel.id}`, {
        title: channel.name,
        source_name: source.name,
        year: '',
        cover: getLogoUrl(channel.logo, source.key),
        index: 1,
        total_episodes: 1,
        play_time: 0,
        total_time: 0,
        save_time: Date.now(),
        search_title: channel.name,
        origin: 'live',
      }).catch(() => undefined);
    }
    return () => { alive = false; };
  }, [channel, source]);

  const groups = useMemo(() => Array.from(new Set(channels.map((item) => item.group || '其他'))), [channels]);
  const filteredChannels = useMemo(() => channels.filter((item) => (item.group || '其他') === selectedGroup), [channels, selectedGroup]);

  const switchChannel = (next: LiveChannel) => {
    setChannel(next);
    setSelectedGroup(next.group || '其他');
    setShowPanel(true);
    if (source) router.replace(`/tv/live/play?source=${encodeURIComponent(source.key)}&id=${encodeURIComponent(next.id)}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') setShowPanel((v) => !v);
      if (event.key === 'Escape') {
        if (showPanel) setShowPanel(false);
        else router.back();
      }
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        const currentIndex = channels.findIndex((item) => item.id === channel?.id);
        if (currentIndex >= 0) {
          const nextIndex = event.key === 'PageUp' ? currentIndex - 1 : currentIndex + 1;
          const next = channels[Math.max(0, Math.min(channels.length - 1, nextIndex))];
          if (next) switchChannel(next);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channel?.id, channels, router, showPanel, source]);

  if (loading) {
    return <main className='fixed inset-0 flex items-center justify-center bg-black text-3xl font-bold text-white'><Loader2 className='mr-4 h-10 w-10 animate-spin text-rose-500' />正在进入电视直播...</main>;
  }

  if (error || !channel) {
    return <main className='fixed inset-0 flex items-center justify-center bg-black p-10 text-center text-3xl font-black text-red-100'>{error || '没有可播放频道'}</main>;
  }

  return (
    <main data-tv-player-root className='fixed inset-0 overflow-hidden bg-black text-white' onMouseMove={() => setShowPanel(true)}>
      {videoUrl ? <TVNativeVideo url={videoUrl} poster={getLogoUrl(channel.logo, source?.key)} live title={channel.name} /> : <div className='flex h-full items-center justify-center text-3xl font-bold'><Loader2 className='mr-4 h-10 w-10 animate-spin text-rose-500' />正在解析直播地址...</div>}

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showPanel ? 'opacity-100' : 'opacity-0'}`}>
        <div className='absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 to-transparent' />
        <div className='absolute inset-y-0 left-0 w-[560px] bg-gradient-to-r from-black/90 to-transparent' />
      </div>

      <div className={`absolute left-8 right-8 top-8 flex items-center justify-between transition-opacity duration-300 ${showPanel ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={() => router.back()} className='tv-focusable flex cursor-pointer items-center gap-3 rounded-2xl bg-black/70 px-5 py-4 text-2xl font-black outline-none backdrop-blur'><ArrowLeft className='h-7 w-7' />返回</button>
        <div className='flex items-center gap-4 rounded-2xl bg-black/70 px-6 py-4 backdrop-blur'>
          {channel.logo ? <img src={getLogoUrl(channel.logo, source?.key)} alt='' className='h-12 w-12 rounded-xl object-contain' /> : <Radio className='h-10 w-10 text-rose-500' />}
          <div><div className='text-3xl font-black'>{channel.name}</div><div className='text-xl text-slate-300'>{source?.name} · {channel.group}</div></div>
        </div>
      </div>

      {showPanel && (
        <aside className='absolute bottom-8 left-8 top-28 grid w-[620px] grid-cols-[190px_1fr] gap-4 rounded-[34px] border border-white/10 bg-slate-950/88 p-5 shadow-2xl shadow-black/70 backdrop-blur-2xl'>
          <div className='overflow-y-auto pr-2'>
            <h2 className='mb-4 text-2xl font-black'>分类</h2>
            <div className='space-y-3'>
              {groups.map((group) => <button key={group} onClick={() => setSelectedGroup(group)} className={`tv-focusable w-full cursor-pointer rounded-2xl px-4 py-4 text-left text-xl font-black outline-none ${selectedGroup === group ? 'bg-rose-600' : 'bg-white/10'}`}>{group}</button>)}
            </div>
          </div>
          <div className='overflow-y-auto pr-2'>
            <h2 className='mb-4 flex items-center gap-2 text-2xl font-black'><Star className='h-6 w-6 text-rose-500' />频道</h2>
            <div className='grid grid-cols-1 gap-3'>
              {filteredChannels.map((item) => <button key={item.id} onClick={() => switchChannel(item)} className={`tv-focusable flex min-h-18 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-xl font-black outline-none ${item.id === channel.id ? 'bg-rose-600' : 'bg-white/10'}`}>{item.logo ? <img src={getLogoUrl(item.logo, source?.key)} alt='' className='h-9 w-9 rounded-lg object-contain' /> : <Radio className='h-8 w-8 text-rose-400' />}<span className='line-clamp-1'>{item.name}</span></button>)}
            </div>
          </div>
        </aside>
      )}
      <TVVirtualRemote />
    </main>
  );
}

export default function TVLivePlayPage() {
  return <Suspense fallback={null}><TVLivePlayClient /></Suspense>;
}
