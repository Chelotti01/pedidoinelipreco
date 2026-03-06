
"use client"

import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, ChevronLeft, FileText, Trash2, Printer, ShoppingBag, Weight, Calendar, ArrowRight, User, Save, CheckCircle2, Edit } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";

export default function OrderHistoryPage() {
  const db = useFirestore();
  const { toast } = useToast();

  const ordersQuery = useMemoFirebase(() => query(collection(db, 'orders'), orderBy('createdAt', 'desc')), [db]);
  const { data: orders, isLoading } = useCollection(ordersQuery);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(db, 'orders', id));
    toast({ title: "Pedido removido", description: "O histórico foi atualizado." });
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

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/orders/new" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico de Pedidos</h1>
            <p className="text-muted-foreground">Visualize e exporte seus pedidos realizados.</p>
          </div>
        </div>
        <Link href="/orders/new">
          <Button className="gap-2">
            <ShoppingBag size={18} /> Novo Pedido
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <History className="animate-spin text-primary" size={48} />
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card className="py-20 text-center">
          <History className="mx-auto mb-4 opacity-20" size={64} />
          <h3 className="text-xl font-semibold">Nenhum pedido encontrado</h3>
          <p className="text-muted-foreground mb-6">Seus pedidos finalizados aparecerão aqui.</p>
          <Link href="/orders/new">
            <Button>Começar Primeiro Pedido</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all">
              <CardHeader className="bg-muted/30 flex flex-row items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary text-white p-3 rounded-full">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">Pedido #{order.id.slice(-6).toUpperCase()}</CardTitle>
                      {getStatusBadge(order.status)}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar size={14} />
                      {order.createdAt ? format(order.createdAt.toDate(), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : 'Processando...'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {order.status === 'DRAFT' && (
                    <Link href={`/orders/edit/${order.id}`}>
                      <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/5">
                        <Edit size={16} /> Editar
                      </Button>
                    </Link>
                  )}
                  <Link href={`/orders/view/${order.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Printer size={16} /> Exportar PDF
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(order.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold">Cliente</p>
                    <div className="flex items-center gap-2 font-bold">
                      <User size={16} className="text-accent" />
                      {order.customerName || 'Não Informado'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold">Resumo Logístico</p>
                    <div className="flex items-center gap-2 font-bold">
                      <Weight size={16} className="text-primary" />
                      {order.totalWeight?.toFixed(2)} Kg
                    </div>
                    <p className="text-xs text-muted-foreground">{order.items?.length} itens</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold">Valor</p>
                    <p className="text-xl font-black text-primary">{formatCurrency(order.totalAmount || 0)}</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <Link href={`/orders/view/${order.id}`} className="w-full md:w-auto">
                      <Button variant="secondary" className="w-full gap-2">
                        Ver Detalhes <ArrowRight size={16} />
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
