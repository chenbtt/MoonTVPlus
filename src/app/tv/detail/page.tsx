'use client';

import { ArrowLeft, Loader2, Play, Server } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { processImageUrl } from '@/lib/utils';
import { SearchResult } from '@/lib/types';

import TVLayout from '@/components/tv/TVLayout';
import { fetchTVDetail } from '@/components/tv/player/utils';

function TVDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const source = searchParams.get('source');
  const id = searchParams.get('id');
  const title = searchParams.get('title');
  const fileName = searchParams.get('fileName');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchTVDetail({ source, id, title, fileName })
      .then((data) => {
        if (!alive) return;
        setDetail(data.detail);
        setSources(data.sources);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : '加载详情失败');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [source, id, title, fileName]);

  const poster = useMemo(() => detail?.poster ? processImageUrl(detail.poster) : '', [detail?.poster]);

  const play = (episode = 0, target = detail) => {
    if (!target) return;
    const qs = new URLSearchParams({
      source: target.source,
      id: target.id,
      title: target.title,
      index: String(episode),
    });
    if (fileName) qs.set('fileName', fileName);
    router.push(`/tv/play?${qs.toString()}`);
  };

  if (loading) {
    return <TVLayout><div className='mt-20 flex items-center justify-center gap-4 text-3xl text-slate-200'><Loader2 className='h-10 w-10 animate-spin text-rose-500' />正在加载详情...</div></TVLayout>;
  }

  if (error || !detail) {
    return <TVLayout><section className='rounded-[36px] border border-red-500/40 bg-red-950/40 p-10 text-3xl font-bold text-red-100'>{error || '详情不存在'}</section></TVLayout>;
  }

  return (
    <TVLayout>
      <section className='relative overflow-hidden rounded-[44px] border border-white/10 bg-slate-950/80 p-8 shadow-2xl shadow-black/70'>
        {poster && <img src={poster} alt='' className='absolute inset-0 h-full w-full object-cover opacity-20 blur-xl' />}
        <div className='relative grid grid-cols-[300px_1fr] gap-10'>
          <div className='overflow-hidden rounded-[32px] bg-slate-900 shadow-2xl shadow-black/70'>
            {poster ? <img src={poster} alt={detail.title} className='aspect-[2/3] h-full w-full object-cover' /> : <div className='aspect-[2/3]' />}
          </div>
          <div className='py-2'>
            <button onClick={() => router.back()} className='tv-focusable mb-6 flex cursor-pointer items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-xl font-bold outline-none'><ArrowLeft className='h-6 w-6' />返回</button>
            <h1 className='text-6xl font-black tracking-tight text-white'>{detail.title}</h1>
            <div className='mt-4 flex flex-wrap gap-3 text-xl font-bold text-slate-200'>
              <span className='rounded-full bg-rose-600 px-4 py-2'>{detail.source_name || detail.source}</span>
              {detail.year && <span className='rounded-full bg-white/10 px-4 py-2'>{detail.year}</span>}
              {detail.type_name && <span className='rounded-full bg-white/10 px-4 py-2'>{detail.type_name}</span>}
              {detail.vod_remarks && <span className='rounded-full bg-white/10 px-4 py-2'>{detail.vod_remarks}</span>}
            </div>
            {detail.desc && <p className='mt-6 line-clamp-5 max-w-5xl text-2xl leading-relaxed text-slate-300'>{detail.desc}</p>}
            <button onClick={() => play(0)} className='tv-focusable mt-8 flex cursor-pointer items-center gap-3 rounded-3xl bg-rose-600 px-9 py-5 text-3xl font-black text-white outline-none'>
              <Play className='h-9 w-9 fill-current' /> 立即播放
            </button>
          </div>
        </div>
      </section>

      {sources.length > 1 && (
        <section className='mt-10 rounded-[36px] border border-white/10 bg-white/[0.04] p-6'>
          <h2 className='mb-5 text-4xl font-black'>播放源</h2>
          <div className='flex flex-wrap gap-4 px-4 py-4'>
            {sources.map((item) => (
              <button key={`${item.source}-${item.id}`} onClick={() => setDetail(item)} className={`tv-focusable flex min-w-[180px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-6 py-4 text-2xl font-bold outline-none ${detail.source === item.source && detail.id === item.id ? 'bg-rose-600 text-white' : 'bg-white/10 text-slate-200'}`}>
                <Server className='h-6 w-6' /> {item.source_name || item.source}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className='mt-10 rounded-[36px] border border-white/10 bg-white/[0.04] p-6'>
        <h2 className='mb-5 text-4xl font-black'>选集</h2>
        <div className='grid grid-cols-3 gap-4 md:grid-cols-5 lg:grid-cols-8'>
          {(detail.episodes_titles?.length ? detail.episodes_titles : detail.episodes).map((ep, index) => (
            <button key={`${ep}-${index}`} onClick={() => play(index)} className='tv-focusable min-h-20 cursor-pointer rounded-2xl bg-white/10 px-4 py-3 text-xl font-black text-white outline-none'>
              {detail.episodes_titles?.[index] || `第 ${index + 1} 集`}
            </button>
          ))}
        </div>
      </section>
    </TVLayout>
  );
}

export default function TVDetailPage() {
  return <Suspense fallback={null}><TVDetailClient /></Suspense>;
}
