import { NavLink, useLocation, useSearchParams } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nb-btn px-3 py-1.5 rounded-lg text-sm uppercase tracking-wider ${
    isActive ? 'bg-nb-yellow' : ''
  }`;

export default function NavBar() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWorkspace = location.pathname === '/workspace';
  const currentMode = searchParams.get('mode') === 'review' ? 'review' : 'edit';

  const setWorkspaceMode = (newMode: 'edit' | 'review') => {
    const nextParams = new URLSearchParams(searchParams);
    if (newMode === 'review') {
      nextParams.set('mode', 'review');
    } else {
      nextParams.delete('mode');
    }
    setSearchParams(nextParams);
  };

  return (
    <nav className="bg-white border-b-[3px] border-black px-3 py-2 flex items-center justify-between gap-3 flex-shrink-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <NavLink to="/" className="font-display text-base sm:text-lg uppercase leading-tight truncate">
          Ôn Tập Chạy Trạm
        </NavLink>

        {isWorkspace && (
          <div className="flex items-center bg-gray-100 border-2 border-black rounded-lg p-0.5 shadow-[2px_2px_0_#000]">
            <button
              type="button"
              onClick={() => setWorkspaceMode('edit')}
              className={`px-2.5 py-0.5 text-xs font-bold rounded uppercase transition-all ${
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
              className={`px-2.5 py-0.5 text-xs font-bold rounded uppercase transition-all ${
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

      <div className="flex gap-2 flex-shrink-0">
        <NavLink to="/" end className={linkClass}>
          📝 Ôn Tập
        </NavLink>
        <NavLink to="/lamde" className={linkClass}>
          🎨 Tạo Đề
        </NavLink>
        <NavLink to="/workspace" className={linkClass}>
          🧪 Workspace (Exp)
        </NavLink>
      </div>
    </nav>
  );
}
