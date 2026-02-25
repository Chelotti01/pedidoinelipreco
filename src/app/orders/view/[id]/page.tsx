
"use client"

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Printer, ChevronLeft, Zap, Calendar } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ViewOrderPage() {
  const params = useParams();
  const db = useFirestore();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const orderRef = useMemoFirebase(() => id ? doc(db, 'orders', id) : null, [db, id]);
  const { data: order, isLoading } = useDoc(orderRef);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-muted-foreground font-medium">Carregando detalhes do pedido...</div>
    </div>
  );
  
  if (!order) return (
    <div className="container mx-auto px-4 py-20 text-center">
      <h2 className="text-2xl font-bold mb-4">Pedido não encontrado</h2>
      <Link href="/orders/history">
        <Button>Voltar para o Histórico</Button>
      </Link>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
          .shadow-2xl { box-shadow: none !important; }
          .bg-primary { background-color: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #e2e8f0 !important; }
        }
      ` }} />

      <div className="mb-8 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link href="/orders/history" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <h1 className="text-2xl font-bold">Detalhes do Pedido</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handlePrint} 
            className="gap-2 border-primary text-primary hover:bg-primary/5"
          >
            <Printer size={18} /> Imprimir / PDF
          </Button>
          <Link href="/orders/new">
            <Button className="gap-2">Novo Pedido</Button>
          </Link>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden print:border print:border-slate-200">
        <CardHeader className="bg-primary text-white p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <Zap size={32} />
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tighter">RELATÓRIO DE PEDIDO</CardTitle>
              <p className="text-white/80 font-medium">#{order.id.toUpperCase()}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end text-sm opacity-80 mb-1">
              <Calendar size={14} />
              {order.createdAt ? format(order.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
            </div>
            <p className="font-bold text-lg">InteliPreço - Sistema Inteligente</p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200">
            <div className="bg-white p-8 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resumo Financeiro</h3>
              <div className="flex justify-between items-end border-b pb-4">
                <span className="text-muted-foreground">Valor Total Bruto:</span>
                <span className="text-3xl font-black text-primary">{formatCurrency(order.totalAmount)}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">Este valor já inclui todos os aditivos de contrato e substituição tributária (ST).</p>
            </div>
            <div className="bg-white p-8 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resumo Logístico</h3>
              <div className="flex justify-between items-end border-b pb-4">
                <span className="text-muted-foreground">Peso Total da Carga:</span>
                <span className="text-3xl font-black text-foreground">{(order.totalWeight || 0).toFixed(2)} <small className="text-sm font-normal">Kg</small></span>
              </div>
              <p className="text-xs text-muted-foreground italic">Cálculo baseado no peso das caixas e quantidades informadas.</p>
            </div>
          </div>

          <div className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Código / Descrição</TableHead>
                  <TableHead className="font-bold text-center">Qtd</TableHead>
                  <TableHead className="font-bold text-right">Preço NET</TableHead>
                  <TableHead className="font-bold text-right text-primary">Preço FINAL (+ST)</TableHead>
                  <TableHead className="font-bold text-right">Total Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="font-bold">{item.code}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{item.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded">EAN: {item.ean}</span>
                        <span className="text-[10px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold">{item.factoryName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-bold">{item.quantity} cx</div>
                      <div className="text-[10px] text-muted-foreground">{item.priceType === 'closed' ? 'F' : 'P'}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatCurrency(item.unitPriceNet)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-bold text-primary">{formatCurrency(item.unitPriceFinal)}</div>
                      <div className="text-[10px] text-destructive">+{item.stRate?.toFixed(0)}% ST</div>
                    </TableCell>
                    <TableCell className="text-right font-black">
                      {formatCurrency(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-xs text-muted-foreground opacity-50 space-y-1">
        <p>Documento gerado eletronicamente via Sistema Pedido InteliPreço.</p>
        <p>Preços sujeitos a alteração conforme vigência da tabela de fábrica no ato do faturamento.</p>
      </div>
    </div>
  );
}
