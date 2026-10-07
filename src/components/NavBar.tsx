import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import ShortcutsDialog from './ShortcutsDialog';
import type { ShortcutRoute } from './ShortcutsDialog';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nb-btn px-3 py-1.5 rounded-lg text-sm uppercase tracking-wider min-h-[44px] ${
    isActive ? 'bg-nb-yellow' : ''
  }`;

const LINKS = [
  { to: '/', end: true, label: '📝 Ôn Tập' },
  { to: '/lamde', end: false, label: '🎨 Tạo Đề' },
  { to: '/workspace', end: false, label: '🧪 Workspace (Exp)' },
];

export default function NavBar() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWorkspace = location.pathname === '/workspace';
  const currentMode = searchParams.get('mode') === 'review' ? 'review' : 'edit';
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const route: ShortcutRoute =
    location.pathname === '/lamde' ? 'lamde' : location.pathname === '/workspace' ? 'workspace' : 'quiz';

  const setWorkspaceMode = (newMode: 'edit' | 'review') => {
    const nextParams = new URLSearchParams(searchParams);
    if (newMode === 'review') {
      nextParams.set('mode', 'review');
    } else {
      nextParams.delete('mode');
    }
    setSearchParams(nextParams);
  };

  // Close the mobile menu on navigation or Escape
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  // Global "?" shortcut for the cheat-sheet (ignored while typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <nav className="bg-white border-b-[3px] border-black px-3 py-2 flex items-center justify-between gap-3 flex-shrink-0 z-30 relative">
      <div className="flex items-center gap-3 min-w-0">
        <NavLink to="/" className="font-display text-base sm:text-lg uppercase leading-tight truncate">
          Ôn Tập Chạy Trạm
        </NavLink>

        {isWorkspace && (
          <div className="flex items-center bg-gray-100 border-2 border-black rounded-lg p-0.5 shadow-[2px_2px_0_#000]">
            <button
              type="button"
              onClick={() => setWorkspaceMode('edit')}
              className={`px-2.5 py-1.5 min-h-[36px] text-xs font-bold rounded uppercase transition-all ${
                currentMode !== 'review'
                  ? 'bg-nb-yellow border border-black shadow-[1px_1px_0_#000]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode('review')}
              className={`px-2.5 py-1.5 min-h-[36px] text-xs font-bold rounded uppercase transition-all ${
                currentMode === 'review'
                  ? 'bg-nb-cyan border border-black shadow-[1px_1px_0_#000]'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              👁️ Review
            </button>
          </div>
        )}
      </div>

      {/* Desktop links */}
      <div className="hidden sm:flex gap-2 flex-shrink-0 items-center">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
            {l.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          aria-label="Mở bảng phím tắt (?)"
          title="Phím tắt (?)"
          className="nb-btn w-11 h-11 rounded-lg font-mono font-bold text-lg leading-none"
        >
          ?
        </button>
      </div>

      {/* Mobile actions */}
      <div className="sm:hidden flex-shrink-0 relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          aria-label="Mở bảng phím tắt"
          className="nb-btn w-11 h-11 rounded-lg font-mono font-bold text-lg leading-none"
        >
          ?
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Mở menu điều hướng"
            className="nb-btn w-11 h-11 rounded-lg text-lg leading-none"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border-[3px] border-black rounded-xl shadow-[4px_4px_0_#000] p-2 flex flex-col gap-2 z-50">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>
      {shortcutsOpen && <ShortcutsDialog route={route} onClose={() => setShortcutsOpen(false)} />}
    </nav>
  );
}
