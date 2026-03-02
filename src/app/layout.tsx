import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthStateProvider } from '@/components/auth-state-provider';

export const metadata: Metadata = {
  title: 'Pedido InteliPreço - Sistema Inteligente de Pedidos',
  description: 'Gestão inteligente de preços e pedidos automatizados via IA.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background min-h-screen text-foreground">
        <FirebaseClientProvider>
          <AuthStateProvider>
            {children}
            <Toaster />
          </AuthStateProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}