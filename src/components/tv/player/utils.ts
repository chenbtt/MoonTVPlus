import { SearchResult } from '@/lib/types';

export async function fetchTVDetail(params: {
  source?: string | null;
  id?: string | null;
  title?: string | null;
  fileName?: string | null;
}): Promise<{ detail: SearchResult; sources: SearchResult[] }> {
  const { source, id, title, fileName } = params;

  if (source && id) {
    const qs = new URLSearchParams({ source, id, title: title || '' });
    if (fileName) qs.set('fileName', fileName);
    const res = await fetch(`/api/source-detail?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('获取视频详情失败');
    const detail = (await res.json()) as SearchResult;
    return { detail, sources: [detail] };
  }

  if (!title) throw new Error('缺少片名');
  const res = await fetch(`/api/search?q=${encodeURIComponent(title)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('搜索播放源失败');
  const data = await res.json();
  const sources = (data.results || []) as SearchResult[];
  if (sources.length === 0) throw new Error('未找到播放源');
  let detail = sources[0];
  if (!detail.episodes?.length) {
    const qs = new URLSearchParams({ source: detail.source, id: detail.id, title: detail.title || title });
    const detailRes = await fetch(`/api/source-detail?${qs.toString()}`, { cache: 'no-store' });
    if (detailRes.ok) detail = (await detailRes.json()) as SearchResult;
  }
  return { detail, sources };
}

export async function resolveTVEpisodeUrl(rawUrl: string, source?: string, proxyMode?: boolean) {
  let url = rawUrl;
  const lazyPrefixes = [
    '/api/xiaoya/play',
    '/api/openlist/play',
    '/api/netdisk/115/play',
    '/api/netdisk/123/play',
    '/api/netdisk/quark/play',
    '/api/netdisk/uc/play',
    '/api/netdisk/baidu/play',
    '/api/source-script/play',
  ];
  if (lazyPrefixes.some((prefix) => url.startsWith(prefix))) {
    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}format=json`, { cache: 'no-store' });
    const data = await res.json();
    if (data.url) url = data.url;
  }

  const isM3u8 = url.toLowerCase().includes('.m3u') || !url.toLowerCase().match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);
  if (proxyMode && source && isM3u8 && !url.startsWith('/api/proxy/')) {
    return `/api/proxy/vod/m3u8?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`;
  }
  return url;
}

export function formatTVTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
