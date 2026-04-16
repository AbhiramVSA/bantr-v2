import { Navigate, Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "../components/ui/Spinner";

export function Landing() {
  const { status, isAuthenticated } = useAuth();

  if (status === "loading") {
    return <Spinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="bg-background font-body text-on-surface overflow-x-hidden">
      <header className="w-full py-4 px-8 sticky top-0 z-50 bg-[#d5ebff] dark:bg-slate-800 mb-8 shadow-[0_12px_40px_rgba(0,75,227,0.06)]">
        <nav className="flex justify-between items-center max-w-[1440px] mx-auto px-10">
          <div className="text-3xl font-black text-[#004be3] dark:text-[#00a6ef] rotate-[-1.5deg] font-headline tracking-tight">
            Bantr
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a className="text-slate-500 hover:text-[#004be3] transition-colors font-headline font-bold" href="#features">
              Practice
            </a>
            <a className="text-slate-500 hover:text-[#004be3] transition-colors font-headline font-bold" href="#testimonials">
              Tournaments
            </a>
            <a className="text-slate-500 hover:text-[#004be3] transition-colors font-headline font-bold" href="#cta">
              Leaderboard
            </a>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex gap-4 items-center">
              <span className="material-symbols-outlined text-slate-500 hover:scale-105 transition-transform cursor-pointer">
                notifications
              </span>
              <span className="material-symbols-outlined text-slate-500 hover:scale-105 transition-transform cursor-pointer">
                settings
              </span>
            </div>
            <Link
              to="/auth"
              className="bg-[#004be3] text-white px-6 py-2.5 rounded-full font-headline font-bold hover:scale-105 transition-transform active:rotate-1"
            >
              Start Debate
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative px-6 pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden bg-gradient-to-br from-primary to-primary-container rounded-b-[4rem] mb-16">
          <PageContainer className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 bg-secondary-container text-on-secondary-fixed rounded-full font-bold text-sm tracking-wider uppercase">
                Master the Mic
              </div>
              <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-on-primary leading-tight -tracking-[0.02em]">
                Own the <span className="text-secondary-fixed">Argument.</span>
                <br />
                Win the Room.
              </h1>
              <p className="text-xl text-on-primary/80 max-w-lg leading-relaxed">
                The world&apos;s first AI-powered voice debate lab. Sharpen your rhetoric, master public speaking, and climb the leaderboard in real-time vocal combat.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/auth"
                  className="bg-secondary-fixed text-on-secondary-fixed px-8 py-4 rounded-full font-headline font-extrabold text-lg shadow-xl hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  GET STARTED FREE
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <Link
                  to="/dashboard"
                  className="bg-white/10 backdrop-blur-md border border-white/20 text-on-primary px-8 py-4 rounded-full font-headline font-extrabold text-lg hover:bg-white/20 transition-all"
                >
                  VIEW TOURNAMENTS
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="bg-surface-container-lowest p-8 rounded-xl rotated-container-right sticker-shadow border-[3px] border-secondary-fixed relative z-20">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-tertiary-container overflow-hidden">
                      <img
                        alt="Debater Profile"
                        className="w-full h-full object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvNGWqv173GkV9QGMVo2kroTxk2WePY79QNKC6nVIDFa8jWY6rYiBKAqsj2Ln0a470KBMYni8kBbsR11m0dTnLernmItzBvHpGKbf7rKHxwLVN7Ryeml5C016fXRXmi6xtLYlUux84lS2eS5J0-hd3Wq5rc9Fp5ZpVxVcJgw4MqxXVoL3DrcZLGTCZHR2F55PCEi8vmQW_6wMLZ9or9h8ydtHyyKhXtjlpJWz4Eu9nJab17ORbWfdROY8BHFMpQ7WrtTgq3Zc"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface">Alex M.</h4>
                      <p className="text-xs text-on-surface-variant font-medium">Pro Speaker Rank</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-3 py-1 bg-primary/10 rounded-full text-primary text-xs font-bold">SPEAKING...</div>
                  </div>
                </div>
                <div className="h-48 bg-surface-container rounded-lg flex flex-col items-center justify-center gap-4 mb-6 overflow-hidden relative">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-12 bg-primary rounded-full" />
                    <div className="w-2 h-24 bg-primary rounded-full" />
                    <div className="w-2 h-16 bg-primary rounded-full" />
                    <div className="w-2 h-32 bg-primary rounded-full" />
                    <div className="w-2 h-20 bg-primary rounded-full" />
                    <div className="w-2 h-28 bg-primary rounded-full" />
                    <div className="w-2 h-14 bg-primary rounded-full" />
                  </div>
                  <div className="text-primary font-headline font-bold text-xl">82.4 Confidence Score</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-surface-container-low p-4 rounded-lg text-center">
                    <span className="material-symbols-outlined text-primary mb-1">graphic_eq</span>
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase">Tone</div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg text-center">
                    <span className="material-symbols-outlined text-primary mb-1">speed</span>
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase">Pace</div>
                  </div>
                  <div className="bg-secondary-container p-4 rounded-lg text-center">
                    <span className="material-symbols-outlined text-on-secondary-fixed mb-1">star</span>
                    <div className="text-[10px] font-bold text-on-secondary-fixed uppercase">Win</div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-tertiary-fixed rounded-full opacity-20 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-secondary-fixed rounded-full opacity-20 blur-3xl" />
            </div>
          </PageContainer>
        </section>

        <section id="features" className="max-w-[1440px] mx-auto px-6 py-24">
          <div className="flex flex-col items-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-headline font-black text-center text-on-surface">The Lab for Modern Rhetoric</h2>
            <div className="w-32 h-2 bg-tertiary-fixed rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-lowest p-10 rounded-xl sticker-shadow md:col-span-2 border-l-8 border-primary flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">mic_none</span>
                </div>
                <h3 className="text-3xl font-headline font-extrabold">Real-time AI Coaching</h3>
                <p className="text-on-surface-variant leading-relaxed text-lg">
                  Our neural engine analyzes your pitch, pace, and persuasive logic in milliseconds, giving you instant corrections as you speak.
                </p>
              </div>
              <div className="w-full md:w-1/3 h-64 bg-surface-container rounded-xl overflow-hidden relative">
                <img
                  alt="AI Interface"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVk8Y0wVZgBLLLUj3Ptnc1GgR4-JS85MvmUa7WRV_nwSXPXwaA9zJ8Q7H9z02Ha8uMBoa9aAHr0MDeUhG7eZcBIfk1cBkd6DoNdBre0wvHGRFeWWkQy760_x0C6nL_elxihCH18944_vSrhZyPZh9xqLgW_D-jtxVY-CLuam7saa2ZNSxhf0RNF_xG4gbcCMl6dX_EwVDGp0kqk3azoe56EeH9B9sJc3IuWzZrjYYKqvObOJB_erHdVc0Z4BKpEFnwDuECU5aH6LE"
                />
                <div className="absolute inset-0 bg-primary/20" />
              </div>
            </div>
            <div className="bg-tertiary-container p-10 rounded-xl sticker-shadow rotated-container-right flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-tertiary-container text-3xl">emoji_events</span>
                </div>
                <h3 className="text-2xl font-headline font-extrabold text-on-tertiary-container">Global Tournaments</h3>
                <p className="text-on-tertiary-container/80 font-medium">Climb from Novice to Grandmaster in live weekly voice tournaments.</p>
              </div>
              <div className="mt-8 px-6 py-3 bg-white/30 rounded-full font-bold text-center text-on-tertiary-container border border-white/20">
                Join Now
              </div>
            </div>
          </div>
        </section>

        <section id="testimonials" className="py-24 bg-surface-container-low overflow-hidden">
          <PageContainer className="px-6">
            <div className="mb-16">
              <h2 className="text-4xl font-headline font-black mb-2">Voices of Bantr</h2>
              <p className="text-primary font-bold uppercase tracking-widest text-sm">Proof in the pitch</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {[
                {
                  quote:
                    "Bantr completely changed how I approach board meetings. The real-time confidence scoring was the game-changer I didn't know I needed.",
                  author: "David Chen",
                  title: "CTO at TechFlow",
                },
                {
                  quote:
                    "I went from sweating through my shirts during presentations to winning regional debate trophies. The AI feedback is brutally honest and helpful.",
                  author: "Sarah Jenkins",
                  title: "University Student",
                },
                {
                  quote:
                    "The competitive aspect makes it feel like a game. I'm literally addicted to improving my rhetoric scores. Highly recommended.",
                  author: "Marcus Thorne",
                  title: "Sales Professional",
                },
              ].map((item, index) => (
                <div
                  key={item.author}
                  className={`bg-white p-8 rounded-xl sticker-shadow relative ${index % 2 === 0 ? "rotated-container-right" : "rotated-container-left"}`}
                >
                  <span className="material-symbols-outlined text-secondary-fixed absolute -top-4 -right-4 text-5xl">format_quote</span>
                  <p className="text-on-surface italic mb-8 leading-relaxed">&quot;{item.quote}&quot;</p>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-surface-container overflow-hidden" />
                    <div>
                      <h5 className="font-bold">{item.author}</h5>
                      <p className="text-xs text-on-surface-variant">{item.title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PageContainer>
        </section>

        <section id="cta" className="max-w-[1200px] mx-auto px-6 py-24 text-center">
          <div className="bg-primary p-16 rounded-xl sticker-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary-fixed/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-tertiary-fixed/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <h2 className="text-4xl md:text-6xl font-headline font-black text-on-primary mb-8 relative z-10">Ready to find your voice?</h2>
            <div className="flex flex-col sm:flex-row gap-6 justify-center relative z-10">
              <Link
                to="/auth"
                className="bg-secondary-fixed text-on-secondary-fixed px-10 py-5 rounded-full font-headline font-extrabold text-xl shadow-2xl hover:scale-110 transition-transform active:scale-95"
              >
                GET STARTED FREE
              </Link>
              <Link
                to="/dashboard"
                className="bg-on-primary text-primary px-10 py-5 rounded-full font-headline font-extrabold text-xl hover:bg-surface-container-lowest transition-colors"
              >
                EXPLORE COURSES
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-on-background pt-24 pb-12 text-surface-container-lowest px-8">
        <PageContainer className="grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-surface-variant/10 pb-16">
          <div className="space-y-6">
            <div className="text-4xl font-headline font-black text-[#00a6ef] rotate-[-1.5deg]">Bantr</div>
            <p className="text-surface-variant/60 leading-relaxed">
              Revolutionizing communication through AI-driven voice feedback and competitive debate.
            </p>
          </div>
          {["Platform", "Resources", "Legal"].map((section) => (
            <div key={section} className="space-y-4">
              <h4 className="font-headline font-bold text-lg text-white">{section}</h4>
              <ul className="space-y-3 text-surface-variant/60 font-medium">
                <li><a className="hover:text-[#00a6ef] transition-colors" href="#">Bantr Link</a></li>
                <li><a className="hover:text-[#00a6ef] transition-colors" href="#">Bantr Link</a></li>
                <li><a className="hover:text-[#00a6ef] transition-colors" href="#">Bantr Link</a></li>
                <li><a className="hover:text-[#00a6ef] transition-colors" href="#">Bantr Link</a></li>
              </ul>
            </div>
          ))}
        </PageContainer>
      </footer>
    </div>
  );
}
