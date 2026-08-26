import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nb-btn px-3 py-1.5 rounded-lg text-sm uppercase tracking-wider ${
    isActive ? 'bg-nb-yellow' : ''
  }`;

export default function NavBar() {
  return (
    <nav className="bg-white border-b-[3px] border-black px-3 py-2 flex items-center justify-between gap-3 flex-shrink-0 z-30">
      <NavLink to="/" className="font-display text-base sm:text-lg uppercase leading-tight truncate">
        Ôn Tập Chạy Trạm
      </NavLink>
      <div className="flex gap-2 flex-shrink-0">
        <NavLink to="/" end className={linkClass}>
          📝 Ôn Tập
        </NavLink>
        <NavLink to="/lamde" className={linkClass}>
          🎨 Tạo Đề
        </NavLink>
      </div>
    </nav>
  );
}
