import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

// DEMO MODE: Set to true to skip Supabase authentication for development
const DEMO_MODE = true;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
  }

  useEffect(() => {
    if (DEMO_MODE) {
      // Demo mode: Create mock admin user
      const mockUser: User = {
        id: 'demo-admin-id',
        email: 'admin@factory.com',
        app_metadata: {},
        user_metadata: { full_name: 'Demo Admin' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const mockProfile: Profile = {
        id: 'demo-admin-id',
        full_name: 'Demo Admin',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUser(mockUser);
      setSession({ user: mockUser, access_token: 'demo-token', expires_in: 999999999, refresh_token: 'demo-refresh', token_type: 'bearer' });
      setProfile(mockProfile);
      setLoading(false);
      return;
    }

    // Normal Supabase authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => { await fetchProfile(session.user.id); })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    if (DEMO_MODE) {
      // Demo mode: Accept any credentials
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      let { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (!prof) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: email.split('@')[0],
          role: 'operator',
        });
        const { data: newProf } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        prof = newProf;
      }
      setProfile(prof);
    }
    return { error: null };
  }

  async function signOut() {
    if (DEMO_MODE) {
      // Demo mode: Just reload the page
      window.location.reload();
      return;
    }
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
