'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownLeft,
  Home,
  Menu,
  Power,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';


const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function getFocusableElements() {
  return Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.closest('[data-tv-remote]'))
    .filter(isVisible);
}

function focusElement(element: HTMLElement) {
  element.focus({ preventScroll: true });

  const isInFixedChrome = Boolean(element.closest('header, [data-tv-remote], [data-tv-player-control], [data-tv-player-root]'));

  // 播放页浮层是 fixed/absolute，不能 scrollIntoView，否则会把全屏播放器滚出视口。
  if (!isInFixedChrome) {
    element.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
    window.requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const safeTop = 150;
      const safeBottom = window.innerHeight - 96;

      if (rect.top < safeTop) {
        window.scrollBy({ top: rect.top - safeTop, behavior: 'smooth' });
      } else if (rect.bottom > safeBottom) {
        window.scrollBy({ top: rect.bottom - safeBottom, behavior: 'smooth' });
      }
    });
  }
}

function moveSpatialFocus(direction: 'up' | 'down' | 'left' | 'right', lastFocused?: HTMLElement | null) {
  const elements = getFocusableElements();
  if (elements.length === 0) return;

  const active = document.activeElement instanceof HTMLElement && !document.activeElement.closest('[data-tv-remote]')
    ? document.activeElement
    : lastFocused && document.body.contains(lastFocused)
    ? lastFocused
    : null;

  if (!active || !elements.includes(active)) {
    focusElement(elements[0]);
    return;
  }

  const current = active.getBoundingClientRect();
  const cx = current.left + current.width / 2;
  const cy = current.top + current.height / 2;

  let best: { element: HTMLElement; score: number } | null = null;

  for (const element of elements) {
    if (element === active) continue;
    const rect = element.getBoundingClientRect();
    const tx = rect.left + rect.width / 2;
    const ty = rect.top + rect.height / 2;
    const dx = tx - cx;
    const dy = ty - cy;

    const inDirection =
      direction === 'right' ? dx > 8 && Math.abs(dx) >= Math.abs(dy) * 0.25 :
      direction === 'left' ? dx < -8 && Math.abs(dx) >= Math.abs(dy) * 0.25 :
      direction === 'down' ? dy > 8 && Math.abs(dy) >= Math.abs(dx) * 0.25 :
      dy < -8 && Math.abs(dy) >= Math.abs(dx) * 0.25;

    if (!inDirection) continue;

    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.4;

    if (!best || score < best.score) {
      best = { element, score };
    }
  }

  if (best) focusElement(best.element);
}

function activateFocused() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && !active.closest('[data-tv-remote]')) {
    active.click();
  }
}

const keys = {
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  ok: { key: 'Enter', code: 'Enter', keyCode: 13 },
  back: { key: 'Escape', code: 'Escape', keyCode: 27 },
  menu: { key: 'ContextMenu', code: 'ContextMenu', keyCode: 93 },
  home: { key: 'Home', code: 'Home', keyCode: 36 },
};

function fireRemoteKey(name: keyof typeof keys) {
  const cfg = keys[name];
  const eventInit: KeyboardEventInit = {
    key: cfg.key,
    code: cfg.code,
    bubbles: true,
    cancelable: true,
  };

  const down = new KeyboardEvent('keydown', eventInit);
  const up = new KeyboardEvent('keyup', eventInit);

  Object.defineProperty(down, 'keyCode', { get: () => cfg.keyCode });
  Object.defineProperty(down, 'which', { get: () => cfg.keyCode });
  Object.defineProperty(up, 'keyCode', { get: () => cfg.keyCode });
  Object.defineProperty(up, 'which', { get: () => cfg.keyCode });

  document.activeElement?.dispatchEvent(down);
  window.dispatchEvent(down);
  document.dispatchEvent(down);

  document.activeElement?.dispatchEvent(up);
  window.dispatchEvent(up);
  document.dispatchEvent(up);
}

function RemoteButton({
  label,
  onClick,
  className = '',
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      className={`flex cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-lg shadow-black/30 outline-none transition hover:bg-white/20 active:scale-95 focus-visible:ring-4 focus-visible:ring-rose-500/70 ${className}`}
    >
      {children}
    </button>
  );
}

export default function TVVirtualRemote() {
  const [open, setOpen] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && !target.closest('[data-tv-remote]')) {
        lastFocusedRef.current = target;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (event.defaultPrevented) return;

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
        moveSpatialFocus(direction, lastFocusedRef.current);
        return;
      }

      if (event.key === 'Enter') {
        const active = document.activeElement;
        if (active instanceof HTMLElement && !active.closest('input, textarea, select') && !active.closest('[data-tv-remote]')) {
          event.preventDefault();
          activateFocused();
        }
        return;
      }

      if (event.key === 'Escape') {
        const path = window.location.pathname;
        const playerPage = path === '/tv/play' || path === '/tv/live/play';
        // 播放页需要优先用返回键关闭选集/频道面板，不能被全局遥控器直接 history.back。
        if (!playerPage) {
          event.preventDefault();
          window.history.back();
        }
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        window.location.href = '/tv';
      }
    };

    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  if (!open) return null;

  return (
    <aside data-tv-remote className='fixed bottom-6 right-6 z-[80] w-[280px] rounded-[34px] border border-white/10 bg-slate-950/88 p-5 text-white shadow-2xl shadow-black/70 backdrop-blur-2xl'>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <div className='text-xl font-black'>虚拟遥控器</div>
          <div className='text-sm text-slate-400'>F1 打开 / 关闭</div>
        </div>
        <RemoteButton label='关闭遥控器' onClick={() => setOpen(false)} className='h-11 w-11 rounded-full bg-rose-600/90 hover:bg-rose-500'>
          <Power className='h-5 w-5' />
        </RemoteButton>
      </div>

      <div className='grid grid-cols-3 gap-3'>
        <RemoteButton label='返回' onClick={() => fireRemoteKey('back')} className='h-14'>
          <RotateCcw className='h-6 w-6' />
        </RemoteButton>
        <RemoteButton label='主页' onClick={() => fireRemoteKey('home')} className='h-14'>
          <Home className='h-6 w-6' />
        </RemoteButton>
        <RemoteButton label='菜单' onClick={() => fireRemoteKey('menu')} className='h-14'>
          <Menu className='h-6 w-6' />
        </RemoteButton>

        <div />
        <RemoteButton label='上' onClick={() => fireRemoteKey('up')} className='h-16'>
          <ChevronUp className='h-9 w-9' />
        </RemoteButton>
        <div />

        <RemoteButton label='左' onClick={() => fireRemoteKey('left')} className='h-16'>
          <ChevronLeft className='h-9 w-9' />
        </RemoteButton>
        <RemoteButton label='确认' onClick={() => fireRemoteKey('ok')} className='h-16 rounded-full bg-white text-black hover:bg-slate-200'>
          <CornerDownLeft className='h-8 w-8' />
        </RemoteButton>
        <RemoteButton label='右' onClick={() => fireRemoteKey('right')} className='h-16'>
          <ChevronRight className='h-9 w-9' />
        </RemoteButton>

        <div />
        <RemoteButton label='下' onClick={() => fireRemoteKey('down')} className='h-16'>
          <ChevronDown className='h-9 w-9' />
        </RemoteButton>
        <div />
      </div>

      <div className='mt-4 rounded-2xl bg-white/[0.06] p-3 text-center text-sm text-slate-300'>
        点击按钮会向当前页面发送方向键 / Enter / Esc
      </div>
    </aside>
  );
}
