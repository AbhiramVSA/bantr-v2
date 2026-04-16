import { NavLink, Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 md:ml-[21rem] p-4 md:p-8">
        <Navbar />
        <Outlet />
      </main>
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-20 glass-nav rounded-full z-50 flex items-center justify-around px-8 shadow-2xl">
        <NavLink to="/dashboard" className="flex flex-col items-center gap-1 text-black">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            dashboard
          </span>
          <span className="text-[10px] font-bold">Dash</span>
        </NavLink>
        <NavLink to="/debates" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="material-symbols-outlined">mic_none</span>
          <span className="text-[10px] font-bold">Debates</span>
        </NavLink>
        <div className="relative -top-10">
          <NavLink
            to="/create"
            className="w-16 h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
          </NavLink>
        </div>
        <NavLink to="/chat" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">Chat</span>
        </NavLink>
        <NavLink to="/settings" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-bold">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
