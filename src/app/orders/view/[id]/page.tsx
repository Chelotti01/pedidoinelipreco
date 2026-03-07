
"use client"

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Printer, ChevronLeft, Zap, Calendar, Home, Loader2, Download, MessageSquare, Gift, AlertCircle } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ViewOrderPage() {
  const params = useParams();
  const { user } = useUser();
  const { toast } = useToast();
  const db = useFirestore();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // OBRIGATÓRIO: Buscar perfil pelo e-mail para SaaS
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  // Pedido amarrado à organização
  const orderRef = useMemoFirebase(() => 
    (id && orgId) ? doc(db, 'organizations', orgId, 'orders', id) : null
  , [db, id, orgId]);
  const { data: order, isLoading: isOrderLoading } = useDoc(orderRef);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !order) return;

    setIsGenerating(true);
    toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto preparamos seu arquivo.",
    });

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = reportRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const scrollables = clonedDoc.querySelectorAll('.overflow-x-auto');
          scrollables.forEach((el: any) => {
            el.style.overflow = 'visible';
            el.style.display = 'block';
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const fileName = `pedido_${order.id.slice(-6).toUpperCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      
      pdf.save(fileName);

      toast({
        title: "Sucesso!",
        description: "Seu PDF foi baixado automaticamente.",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um problema técnico. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isProfileLoading || isOrderLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="animate-spin text-primary" size={48} />
      <div className="text-muted-foreground font-medium">Carregando detalhes do pedido...</div>
    </div>
  );
  
  if (!orgId) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertCircle size={64} className="mx-auto text-destructive opacity-20 mb-4" />
        <h2 className="text-2xl font-bold">Erro de Vínculo</h2>
        <Link href="/orders/history"><Button variant="outline" className="mt-6">Voltar</Button></Link>
      </div>
    );
  }

  if (!order) return (
    <div className="container mx-auto px-4 py-20 text-center">
      <AlertCircle size={64} className="mx-auto text-destructive opacity-20 mb-4" />
      <h2 className="text-2xl font-bold mb-4">Pedido não encontrado</h2>
      <Link href="/orders/history">
        <Button>Voltar para o Histórico</Button>
      </Link>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link href="/orders/history" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <h1 className="text-2xl font-bold">Detalhes do Pedido</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" title="Início">
              <Home size={20} />
            </Button>
          </Link>
          <Button 
            variant="default" 
            onClick={handleDownloadPDF} 
            disabled={isGenerating}
            className="gap-2 bg-primary text-white hover:bg-primary/90 font-bold shadow-lg"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Download size={18} />
            )}
            Gerar PDF / Download
          </Button>
          <Link href="/orders/new">
            <Button variant="outline" className="gap-2">Novo Pedido</Button>
          </Link>
        </div>
      </div>

      <div ref={reportRef} className="bg-white p-4 sm:p-8 rounded-xl">
        <Card className="shadow-none border-slate-200 overflow-hidden">
          <CardHeader className="bg-primary text-white p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Zap size={32} />
              </div>
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-black tracking-tighter">RELATÓRIO DE PEDIDO</CardTitle>
                <p className="text-white/80 font-medium text-sm sm:text-base">#{order.id.toUpperCase()}</p>
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className="flex items-center gap-2 md:justify-end text-sm opacity-80 mb-1">
                <Calendar size={14} />
                {order.createdAt ? format(order.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
              </div>
              <p className="font-bold text-lg">InteliPreço - {profile?.organizationId || 'SaaS'}</p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="p-6 sm:p-8 border-b bg-slate-50/50">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Cliente</h3>
              <p className="text-xl font-bold text-primary flex items-center gap-2">
                <Home size={18} className="text-accent" /> {order.customerName}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200">
              <div className="p-6 sm:p-8 space-y-4 border-b md:border-b-0 md:border-r border-slate-200">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resumo Financeiro</h3>
                <div className="flex justify-between items-end">
                  <span className="text-muted-foreground">Valor Total Bruto:</span>
                  <span className="text-2xl sm:text-3xl font-black text-primary">{formatCurrency(order.totalAmount)}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground italic">Este valor já inclui todos os aditivos de contrato e substituição tributária (ST).</p>
              </div>
              <div className="p-6 sm:p-8 space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resumo Logístico</h3>
                <div className="flex justify-between items-end">
                  <span className="text-muted-foreground">Peso Total da Carga:</span>
                  <span className="text-2xl sm:text-3xl font-black text-foreground">{(order.totalWeight || 0).toFixed(2)} <small className="text-sm font-normal">Kg</small></span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground italic">Cálculo baseado no peso das caixas e quantidades informadas.</p>
              </div>
            </div>

            {order.notes && (
              <div className="p-6 sm:p-8 border-b border-slate-200 bg-slate-50">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MessageSquare size={14} className="text-primary" /> Observações do Pedido
                </h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            <div className="overflow-x-auto">
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
                    <TableRow key={`${item.productId}-${idx}`} className={item.isBonus ? "bg-accent/5" : ""}>
                      <TableCell className="min-w-[200px]">
                        <div className="font-bold text-sm">{item.code}</div>
                        <div className="text-[11px] text-muted-foreground leading-tight mb-1">{item.name}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">EAN: {item.ean}</span>
                          <span className="text-[10px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold border border-primary/10">{item.factoryName}</span>
                          {item.isBonus && <Badge className="bg-accent text-white border-none h-5 px-1.5 text-[10px] flex items-center gap-1"><Gift size={10} /> BONIFICAÇÃO</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-bold text-sm">{item.quantity} cx</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{item.priceType === 'closed' ? 'Fechada' : 'Frac'}</div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.isBonus ? '-' : (item.unitPriceNet || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-bold text-sm ${item.isBonus ? 'text-accent' : 'text-primary'}`}>{item.isBonus ? 'BONUS' : (item.unitPriceFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {!item.isBonus && (
                          <div className="text-[10px] text-destructive font-medium">
                            +{(item.stRate || 0).toFixed(2).replace('.', ',')}% ST
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-black text-sm">
                        {item.isBonus ? 'R$ 0,00' : (item.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-[10px] text-muted-foreground opacity-60 space-y-1">
          <p>Documento gerado eletronicamente via Sistema Pedido InteliPreço em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}.</p>
          <p>Preços sujeitos a alteração conforme vigência da tabela de fábrica no ato do faturamento.</p>
        </div>
      </div>
    </div>
  );
}
