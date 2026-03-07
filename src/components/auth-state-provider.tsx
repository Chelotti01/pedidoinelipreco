'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';

export function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Busca perfil pelo e-mail do usuário (ID do documento)
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  useEffect(() => {
    if (!isUserLoading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-100">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
          <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-primary [animation-duration:3s]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-primary">InteliPreço SaaS</p>
          <p className="text-[10px] font-bold text-muted-foreground animate-pulse">Sincronizando ambiente seguro...</p>
        </div>
      </div>
    );
  }

  if (user && !profile && pathname !== '/login' && pathname !== '/super-admin') {
    const isMasterAdmin = user.email === 'vendas.piracanjuba@gmail.com';
    if (!isMasterAdmin) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center p-6 text-center bg-slate-50">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md border border-slate-200">
            <div className="w-20 h-20 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">ACESSO NÃO VINCULADO</h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              O e-mail <strong className="text-slate-800">{user.email}</strong> ainda não foi associado a nenhuma organização em nossa plataforma.
            </p>
            <div className="space-y-3">
              <Button className="w-full h-12 font-bold" variant="outline" onClick={() => auth.signOut()}>
                <LogOut size={18} className="mr-2" /> Sair da Conta
              </Button>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Consulte seu administrador</p>
            </div>
          </div>
        </div>
      );
    }
  }

  if (!user && pathname !== '/login') return null;

  return <>{children}</>;
}