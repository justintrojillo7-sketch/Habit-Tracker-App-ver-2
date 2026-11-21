import React, { useState } from 'react';
import { AlertCircle, Loader2, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';

export const SignInGate: React.FC = () => {
  const {
    cloudUser,
    cloudAuthReady,
    cloudLoading,
    cloudError,
    signInCloud,
    signOutCloud,
  } = useLifeHQ();
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInCloud();
    } finally {
      setSigningIn(false);
    }
  };

  const isLoadingWorkspace =
    !cloudAuthReady || Boolean(cloudUser && cloudUser.emailVerified && cloudLoading);
  const isUnverified = Boolean(cloudUser && !cloudUser.emailVerified);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#f8f9fb] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-7 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <img
            src="/icon.svg"
            alt="LifeHQ logo"
            className="w-14 h-14 rounded-2xl shadow-sm"
          />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            LifeHQ
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Personal life operating system
          </p>
        </div>

        {isLoadingWorkspace ? (
          <div className="mt-8 flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500 dark:text-slate-400" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preparing your private workspace…
            </p>
          </div>
        ) : isUnverified ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/70 p-4 text-left">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-semibold">Verified email required</p>
                  <p>
                    Signed in as{' '}
                    <span className="font-mono">
                      {cloudUser?.email ?? 'this account'}
                    </span>
                    , but its email address is not verified yet. Verify your
                    Google account email or sign in with another verified Google
                    account.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOutCloud()}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Private per-account workspace</span>
              </div>
              <p className="leading-relaxed">
                Sign in with any verified Google account to open your own isolated
                calendar, habits, tracking, goals, and pillars workspace synced in
                real time.
              </p>
            </div>

            {cloudError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cloudError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2.5 min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 disabled:opacity-60 transition"
            >
              {signingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
              After signing in, you can optionally import a saved JSON backup or
              previous browser setup from Settings or Today.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
