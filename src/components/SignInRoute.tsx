import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { resolveSignedInDestination } from '../services/signInDestination';

export default function SignInRoute({ children }: { children: React.ReactNode }) {
  const [destination, setDestination] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const redirect = session ? await resolveSignedInDestination(session) : null;
        if (!cancelled) setDestination(redirect);
      } catch {
        if (!cancelled) setDestination(null);
      }
    }

    void checkSession();
    return () => { cancelled = true; };
  }, []);

  if (destination === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50" role="status">
        Checking your session…
      </div>
    );
  }

  return destination ? <Navigate to={destination} replace /> : <>{children}</>;
}
