import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/cn";

export function Sidebar() {
  const { user, logoutUser } = useAuth();
  const navItems = [
    { to: "/dashboard", icon: "dashboard", label: "Dashboard" },
    { to: "/debates", icon: "mic_none", label: "My Debates" },
    { to: "/create", icon: "graphic_eq", label: "Create Debate" },
    { to: "/chat", icon: "analytics", label: "Coach Chat" },
    { to: "/resources", icon: "library_books", label: "Resources" },
  ];

  async function handleLogout() {
    await logoutUser();
  }

  return (
    <aside className="flex flex-col p-6 fixed left-0 top-0 overflow-y-auto hidden md:flex bg-white dark:bg-slate-950 rounded-[3rem] h-[calc(100vh-2rem)] m-4 w-72 shadow-[0_12px_40px_rgba(0,0,0,0.06)] z-50">
      <div className="flex items-center gap-4 mb-10 px-4">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-primary-container flex items-center justify-center text-primary font-headline font-black">
          B
        </div>
        <div>
          <p className="font-headline font-bold text-on-background">{user?.username ?? "Debate Coach"}</p>
          <p className="text-xs text-on-surface-variant font-medium">Level: {user?.role ?? "Pro Speaker"}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-2 no-border">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to !== "/debates"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-6 py-4 rounded-full transition-all duration-300",
                isActive
                  ? "bg-[#bef500] text-black font-bold scale-105 shadow-sm"
                  : "text-slate-600 hover:bg-[#d5ebff] hover:translate-x-2",
              )
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-6">
        <Link
          to="/settings"
          className="w-full inline-flex items-center justify-center bg-primary text-on-primary py-4 rounded-full font-headline font-bold uppercase tracking-wider text-sm spring-bounce-interaction"
        >
          Upgrade to Pro
        </Link>
        <div className="space-y-1">
          {user?.permissions.includes("users:read") ? (
            <NavLink
              to="/admin/users"
              className="flex items-center gap-3 px-6 py-3 text-slate-600 hover:bg-[#d5ebff] rounded-full hover:translate-x-2 transition-all duration-300"
            >
              <span className="material-symbols-outlined">shield_person</span>
              <span>Admin Users</span>
            </NavLink>
          ) : null}
          <NavLink
            to="/settings"
            className="flex items-center gap-3 px-6 py-3 text-slate-600 hover:bg-[#d5ebff] rounded-full hover:translate-x-2 transition-all duration-300"
          >
            <span className="material-symbols-outlined">manage_accounts</span>
            <span>Settings</span>
          </NavLink>
          <NavLink
            to="/resources"
            className="flex items-center gap-3 px-6 py-3 text-slate-600 hover:bg-[#d5ebff] rounded-full hover:translate-x-2 transition-all duration-300"
          >
            <span className="material-symbols-outlined">help_outline</span>
            <span>Resources</span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-6 py-3 text-slate-600 hover:bg-[#d5ebff] rounded-full hover:translate-x-2 transition-all duration-300"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
