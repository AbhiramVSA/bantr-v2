import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Input } from "../components/ui/Input";
import { ErrorState } from "../components/ui/ErrorState";
import { useAuth } from "../hooks/useAuth";
import { getGoogleLoginUrl } from "../services/auth";
import { ApiError } from "../types/api";

type AuthMode = "login" | "register";

export function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword, registerWithPassword, status } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname ?? "/dashboard";
  }, [location.state]);

  useEffect(() => {
    if (status === "authenticated") {
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      if (mode === "login") {
        await loginWithPassword({ email, password });
      } else {
        await registerWithPassword({ email, username, password });
      }
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Unable to complete authentication.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="font-body bg-background min-h-screen flex items-center justify-center p-6 kinetic-gradient selection:bg-secondary-container selection:text-on-secondary-container">
      <main className="w-full max-w-md relative">
        <div className="absolute -top-12 -right-8 w-24 h-24 text-secondary-fixed opacity-50 rotate-12 pointer-events-none">
          <svg fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 50Q30 10 50 50T90 50" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
            <path d="M70 30L90 50L70 70" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </svg>
        </div>
        <div className="absolute -bottom-8 -left-12 w-32 h-32 text-tertiary-fixed opacity-30 -rotate-6 pointer-events-none">
          <svg fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="30" stroke="currentColor" strokeDasharray="8 4" strokeWidth="2" />
          </svg>
        </div>

        <div className="bg-surface-container-lowest rounded-xl sticker-shadow p-10 md:p-12 relative overflow-hidden flex flex-col items-center">
          <div className="mb-10 text-center">
            <div className="inline-block text-3xl font-black text-primary rotate-[-1.5deg] font-headline tracking-tighter mb-2">
              Bantr
            </div>
            <h1 className="text-on-background font-headline font-extrabold text-2xl tracking-tight">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-on-surface-variant text-sm mt-2">
              {mode === "login" ? "Ready to win your next argument?" : "Step into the arena with your Bantr profile."}
            </p>
          </div>

          {errorMessage ? <ErrorState message={errorMessage} /> : null}

          <a
            href={getGoogleLoginUrl()}
            className="mt-6 w-full flex items-center justify-center gap-3 py-4 px-6 bg-surface-container-lowest border-2 border-surface-container rounded-full hover:scale-[1.03] transition-all duration-300 active:scale-95 group"
          >
            <img
              alt="Google Logo"
              className="w-6 h-6"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRoGYCPpSzKUVW53z2TJqtt_74VOnZeuqtFGBmJDWxTXNlHFOZ7qKZ7zJxEp8cbtq1rjoauWTxXqiUAJK-Unj_SamaI2KqoIa4Ni_3y0spVtnHxbcnNEVhE556a2GwIBwgKuWVn_UmGautA1fYOnyTJ5erpak5qHAppEvo-Sw3TJnvp6Gy7xWYvB2AwwAFmkYjP120g1ilUvCbufuZ_kneFCkEo1-MScdzEllD_4gsChKCJLMhzAB09s2IsvsGklpxv_pNkRxJ26c"
            />
            <span className="text-on-surface font-headline font-bold text-sm tracking-wide uppercase">
              Continue with Google
            </span>
          </a>

          <div className="w-full flex items-center gap-4 my-8">
            <div className="h-[1px] flex-1 bg-surface-container" />
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">or</span>
            <div className="h-[1px] flex-1 bg-surface-container" />
          </div>

          <form className="w-full space-y-6" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <div className="relative">
                <label htmlFor="auth-username" className="absolute -top-3 left-4 bg-surface-container-high px-3 py-0.5 rounded-full z-10 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-tighter">Username</span>
                </label>
                <Input id="auth-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="bantrchamp" autoComplete="username" />
              </div>
            ) : null}

            <div className="relative">
              <label htmlFor="auth-email" className="absolute -top-3 left-4 bg-secondary-container px-3 py-0.5 rounded-full z-10 shadow-sm">
                <span className="text-[10px] font-black uppercase text-on-secondary-container tracking-tighter">Email</span>
              </label>
              <Input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@voice.com" type="email" autoComplete="email" />
            </div>

            <div className="relative">
              <label htmlFor="auth-password" className="absolute -top-3 left-4 bg-surface-container-high px-3 py-0.5 rounded-full z-10 shadow-sm">
                <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-tighter">Password</span>
              </label>
              <Input
                id="auth-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            <button
              className="w-full bg-primary text-on-primary py-4 rounded-full font-headline font-extrabold text-sm tracking-[0.05em] uppercase sticker-shadow hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 group"
              disabled={submitting || status === "loading"}
              type="submit"
            >
              <span>{submitting ? "Entering..." : mode === "login" ? "Enter the Lab" : "Create Profile"}</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-2">
            <Link className="text-primary font-bold text-sm hover:underline decoration-secondary-fixed decoration-4 underline-offset-4 transition-all" to="/">
              Forgot password?
            </Link>
            <p className="text-on-surface-variant text-sm mt-4">
              {mode === "login" ? "New here?" : "Already inside?"}{" "}
              <button
                type="button"
                className="text-primary font-bold hover:text-inverse-on-surface transition-colors"
                onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
