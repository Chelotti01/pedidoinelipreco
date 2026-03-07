
"use client"

import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, ChevronLeft, FileText, Trash2, Printer, ShoppingBag, Weight, Calendar, ArrowRight, User, Save, CheckCircle2, Edit, Loader2 } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";

export default function OrderHistoryPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // OBRIGATÓRIO: Buscar perfil pelo e-mail para SaaS
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const ordersQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'orders'), orderBy('createdAt', 'desc')) : null
  , [db, orgId]);
  
  const { data: orders, isLoading: isOrdersLoading } = useCollection(ordersQuery);

  const handleDelete = (id: string) => {
    if (!orgId) return;
    deleteDocumentNonBlocking(doc(db, 'organizations', orgId, 'orders', id));
    toast({ title: "Pedido removido" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 gap-1"><Save size={12} /> Rascunho</Badge>;
      case 'CONFIRMED':
        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 gap-1"><CheckCircle2 size={12} /> Confirmado</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Finalizado'}</Badge>;
    }
  };

  if (isProfileLoading || isOrdersLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  if (!orgId) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Erro de Vínculo</h2>
        <p className="text-muted-foreground mt-2">Você não possui uma organização associada.</p>
        <Link href="/"><Button variant="outline" className="mt-6">Voltar</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico de Pedidos</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase">Gestão da Organização: {orgId}</p>
          </div>
        </div>
        <Link href="/orders/new">
          <Button className="gap-2">
            <ShoppingBag size={18} /> Novo Pedido
          </Button>
        </Link>
      </div>

      {!orders || orders.length === 0 ? (
        <Card className="py-20 text-center border-dashed bg-muted/20">
          <CardContent>
            <History className="mx-auto mb-4 opacity-10" size={64} />
            <h3 className="text-xl font-bold text-muted-foreground">Nenhum pedido realizado</h3>
            <p className="text-sm text-muted-foreground mb-6">Comece agora mesmo a emitir novos orçamentos.</p>
            <Link href="/orders/new"><Button>Criar Meu Primeiro Pedido</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all border-l-4 border-l-primary">
              <CardHeader className="bg-muted/30 flex flex-row items-center justify-between flex-wrap gap-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-xl shadow-sm text-primary">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base font-black">#{order.id.slice(-6).toUpperCase()}</CardTitle>
                      {getStatusBadge(order.status)}
                    </div>
                    <CardDescription className="text-[10px] font-bold flex items-center gap-1">
                      <Calendar size={10} />
                      {order.createdAt ? format(order.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {order.status === 'DRAFT' && (
                    <Link href={`/orders/edit/${order.id}`}>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 font-bold"><Edit size={14} /> Editar</Button>
                    </Link>
                  )}
                  <Link href={`/orders/view/${order.id}`}>
                    <Button variant="secondary" size="sm" className="h-8 gap-1.5 font-bold"><Printer size={14} /> Ver PDF</Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => handleDelete(order.id)}><Trash2 size={14} /></Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Cliente</p>
                    <div className="flex items-center gap-2 font-bold text-slate-700 truncate">
                      <User size={14} className="text-accent" />
                      {order.customerName}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Logística</p>
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <Weight size={14} className="text-primary" />
                      {order.totalWeight?.toFixed(2)} Kg
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Valor Bruto</p>
                    <p className="text-xl font-black text-primary">R$ {order.totalAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <Link href={`/orders/view/${order.id}`} className="w-full">
                      <Button variant="ghost" className="w-full gap-2 font-bold group">
                        Abrir <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
