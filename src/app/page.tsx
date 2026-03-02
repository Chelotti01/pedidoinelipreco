
"use client"

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShoppingCart, ListChecks, Zap, History, Users, LogOut, Package, FileSpreadsheet, Settings } from "lucide-react";
import { useEffect } from 'react';

export default function Home() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Se for a Adriana, ela nem deve ver esta página, redireciona para o novo pedido
    if (user?.email === 'adriana@inteli-preco.com') {
      router.push('/orders/new');
    }
  }, [user, router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (user?.email === 'adriana@inteli-preco.com') return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg text-white">
              <Zap size={20} fill="white" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-primary">InteliPreço</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-muted-foreground hidden sm:inline-block">RODRIGO (ADMIN)</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-slate-800">Painel de Controle</h2>
          <p className="text-muted-foreground">Gerencie o catálogo de preços e pedidos do sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/orders/new" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-primary text-white">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <ShoppingCart size={24} />
                </div>
                <CardTitle className="text-xl">Novo Pedido</CardTitle>
                <CardDescription className="text-white/70">Emita um novo pedido com preços dinâmicos.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/catalog" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                  <Package size={24} />
                </div>
                <CardTitle className="text-xl">Catálogo de Fábrica</CardTitle>
                <CardDescription>Visualize os preços importados das planilhas XLSX.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/orders/history" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                  <History size={24} />
                </div>
                <CardTitle className="text-xl">Histórico</CardTitle>
                <CardDescription>Consulte e exporte PDFs de pedidos realizados.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/products" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mb-4">
                  <ListChecks size={24} />
                </div>
                <CardTitle className="text-xl">Produtos Registrados</CardTitle>
                <CardDescription>Gerencie o cadastro paralelo e amarração de preços.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/customers" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
                  <Users size={24} />
                </div>
                <CardTitle className="text-xl">Base de Clientes</CardTitle>
                <CardDescription>Cadastre e edite informações dos seus clientes.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/upload" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border-2 border-dashed border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
                  <FileSpreadsheet size={24} />
                </div>
                <CardTitle className="text-xl">Importar XLSX</CardTitle>
                <CardDescription>Atualize os preços de todas as fábricas via planilha.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </main>

      <footer className="py-6 border-t bg-white text-center">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          InteliPreço © {new Date().getFullYear()} - Sistema Inteligente de Pedidos
        </p>
      </footer>
    </div>
  );
}
