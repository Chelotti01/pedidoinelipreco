
"use client"

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShoppingCart, ListChecks, ArrowRight, ShieldCheck, Zap, History, Weight, Users, LogOut } from "lucide-react";

export default function Home() {
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg text-white">
              <Zap size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-primary">Pedido InteliPreço</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/orders/history" className="text-sm font-medium hover:text-primary transition-colors">Histórico</Link>
            <Link href="/catalog" className="text-sm font-medium hover:text-primary transition-colors">Catálogo</Link>
            <Link href="/admin/products" className="text-sm font-medium hover:text-primary transition-colors">Produtos</Link>
            <Link href="/admin/customers" className="text-sm font-medium hover:text-primary transition-colors text-accent font-bold">Clientes</Link>
            <Link href="/upload" className="text-sm font-medium hover:text-primary transition-colors">Importar XLSX</Link>
            <Link href="/orders/new">
              <Button size="sm" className="gap-2">
                <ShoppingCart size={16} /> Novo Pedido
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut size={20} />
            </Button>
          </nav>
          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-white to-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground">
              Pedidos Inteligentes com <span className="text-primary">Precisão de IA</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Importe suas tabelas de preços XLSX e deixe nossa IA organizar produtos, fábricas e descontos automaticamente para você.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/orders/new">
                <Button size="lg" className="h-14 px-8 text-lg gap-2 shadow-xl">
                  <ShoppingCart size={20} /> Começar Pedido
                </Button>
              </Link>
              <Link href="/admin/customers">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg gap-2 border-primary text-primary">
                  <Users size={20} /> Gerenciar Clientes
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="border-none shadow-md bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                    <History size={24} />
                  </div>
                  <CardTitle>Histórico & PDF</CardTitle>
                  <CardDescription>
                    Mantenha o registro de todas as vendas e exporte orçamentos em PDF com um clique.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-md bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <CardTitle>Cálculo de ST</CardTitle>
                  <CardDescription>
                    Impostos de Substituição Tributária calculados automaticamente por item.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-md bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                    <Weight size={24} />
                  </div>
                  <CardTitle>Controle Logístico</CardTitle>
                  <CardDescription>
                    Soma automática de pesos das caixas para despacho imediato da carga.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white py-10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
             <Zap size={16} className="text-primary" />
             <span className="font-semibold text-primary">Pedido InteliPreço</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2024 Pedido InteliPreço. Transformando dados em agilidade.</p>
        </div>
      </footer>
    </div>
  );
}
