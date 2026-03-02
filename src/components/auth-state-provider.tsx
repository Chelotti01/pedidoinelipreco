
'use client';

import { useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        // Redireciona para a home ou orders se já estiver logado
        if (user?.email === 'adriana@inteli-preco.com') {
          router.push('/orders/new');
        } else {
          router.push('/');
        }
      } else if (user && user.email === 'adriana@inteli-preco.com' && pathname !== '/orders/new') {
        // Restrição específica da Adriana: ela SÓ pode acessar /orders/new
        router.push('/orders/new');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Impede a renderização de conteúdo protegido se não estiver logado e não estiver na página de login
  // Isso evita que hooks de dados (useCollection, useDoc) disparem erros de permissão "auth: null"
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
