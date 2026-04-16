import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="w-full py-4 px-8 sticky top-0 z-40 bg-[#f1f7ff] dark:bg-slate-900 mb-8 rounded-xl shadow-[0_12px_40px_rgba(0,75,227,0.06)] flex justify-between items-center max-w-[1440px] mx-auto">
      <div className="flex items-center gap-8">
        <Link
          to="/dashboard"
          className="text-3xl font-black text-[#004be3] dark:text-[#00a6ef] rotate-[-1.5deg] font-headline tracking-tight"
        >
          Bantr
        </Link>
        <nav className="hidden lg:flex items-center gap-6 font-headline font-bold text-slate-500">
          <NavLink to="/create" className="hover:text-[#004be3] transition-colors">
            Create Debate
          </NavLink>
          <NavLink to="/debates" className="hover:text-[#004be3] transition-colors">
            My Debates
          </NavLink>
          <NavLink to="/chat" className="hover:text-[#004be3] transition-colors">
            Coach Chat
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-6">
        <Link
          to="/create"
          className="bg-[#bef500] text-on-primary-fixed px-6 py-3 rounded-full font-headline font-bold text-sm hover:scale-105 transition-transform duration-200 active:rotate-1"
        >
          Start Debate
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/notifications"
            className="p-2 text-primary hover:bg-surface-container rounded-full transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
          </Link>
          <Link
            to="/settings"
            className="p-2 text-primary hover:bg-surface-container rounded-full transition-colors"
            title="Settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <Link
            to="/settings"
            className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden bg-primary text-on-primary font-bold flex items-center justify-center"
            title="Profile"
          >
            {user?.username?.charAt(0).toUpperCase() ?? "B"}
          </Link>
        </div>
      </div>
    </header>
  );
}
