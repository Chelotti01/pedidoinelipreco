
'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { doc } from 'firebase/firestore';

export function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  // Buscar perfil para verificar organizationId
  const userProfileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
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
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sincronizando Ambiente SaaS...</p>
      </div>
    );
  }

  // Se logado mas sem perfil/organização, e não for super admin
  if (user && !profile && pathname !== '/login' && pathname !== '/super-admin') {
    // Verificar se é um e-mail de super admin hardcoded (opcional)
    const isHardcodedSuper = ['vendas.piracanjuba@gmail.com'].includes(user.email || '');
    if (!isHardcodedSuper) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center p-6 text-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-2xl font-black text-slate-800 mb-2">ACESSO NÃO VINCULADO</h1>
          <p className="text-muted-foreground max-w-md">
            Seu usuário ainda não foi vinculado a uma organização. 
            Entre em contato com o administrador do sistema.
          </p>
          <Button variant="link" onClick={() => auth.signOut()} className="mt-4">Sair do Sistema</Button>
        </div>
      );
    }
  }

  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
