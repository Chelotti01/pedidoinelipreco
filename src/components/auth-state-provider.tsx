'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { collection, query, where, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';

export function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Buscar perfil pelo e-mail do usuário para suportar pré-cadastro
  const userProfileQuery = useMemoFirebase(() => 
    user?.email ? query(collection(db, 'userProfiles'), where('email', '==', user.email), limit(1)) : null
  , [db, user]);
  
  const { data: profiles, isLoading: isProfileLoading } = useCollection(userProfileQuery);
  const profile = profiles?.[0];

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
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sincronizando Ambiente SaaS...</p>
      </div>
    );
  }

  // Se logado mas sem perfil/organização, e não for super admin hardcoded
  if (user && !profile && pathname !== '/login' && pathname !== '/super-admin') {
    const isHardcodedSuper = ['vendas.piracanjuba@gmail.com'].includes(user.email || '');
    if (!isHardcodedSuper) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center p-6 text-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-2xl font-black text-slate-800 mb-2">ACESSO NÃO VINCULADO</h1>
          <p className="text-muted-foreground max-w-md">
            Seu usuário ({user.email}) ainda não foi vinculado a uma organização. 
            Entre em contato com o administrador do sistema.
          </p>
          <Button variant="outline" onClick={() => auth.signOut()} className="mt-4">Sair do Sistema</Button>
        </div>
      );
    }
  }

  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}