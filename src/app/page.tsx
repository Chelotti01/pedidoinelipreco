
"use client"

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShoppingCart, ListChecks, Zap, History, Users, LogOut, Package, FileSpreadsheet, FileDown, Loader2, LayoutGrid } from "lucide-react";
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Home() {
  const auth = useAuth();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [showExportConfigDialog, setShowExportConfigDialog] = useState(false);
  const [exportFactoryId, setExportFactoryId] = useState<string>("none");
  const [exportLineFilter, setExportLineFilter] = useState<string>("none");
  const [exportContractPercent, setExportContractPercent] = useState<number>(0);
  const [exportPriceType, setExportPriceType] = useState<'closed' | 'fractional'>('closed');
  const [exportBrand, setExportBrand] = useState<string>("all");

  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => query(collection(db, 'registered_products'), orderBy('description')), [db]);
  const { data: registeredProducts } = useCollection(registeredProductsQuery);

  const catalogProductsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products')), [db]);
  const { data: catalogProducts } = useCollection(catalogProductsQuery);

  useEffect(() => {
    if (user?.email === 'adriana@inteli-preco.com') {
      router.push('/orders/new');
    }
  }, [user, router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  const handleExportPDF = async () => {
    if (exportFactoryId === "none" || exportLineFilter === "none") {
      toast({ title: "Filtros incompletos", description: "Selecione Fábrica e Linha para gerar o PDF.", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    toast({ title: "Processando PDF", description: "Aguarde enquanto vinculamos os preços..." });

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const filtered = registeredProducts?.filter(p => 
        p.factoryId === exportFactoryId && 
        p.line === exportLineFilter &&
        (exportBrand === "all" || p.brand === exportBrand)
      ) || [];

      if (filtered.length === 0) {
        toast({ title: "Nenhum item", description: "Não há produtos registrados para esses filtros.", variant: "destructive" });
        setIsExporting(false);
        return;
      }

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.backgroundColor = 'white';
      container.style.padding = '20mm';
      container.style.fontFamily = 'sans-serif';

      const factoryName = factories?.find(f => f.id === exportFactoryId)?.name || 'Fábrica';
      
      container.innerHTML = `
        <div style="border-bottom: 3px solid #334155; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; color: #334155; font-size: 24px; font-weight: 900;">TABELA DE PREÇOS</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${factoryName} - ${exportLineFilter}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: bold; font-size: 12px;">InteliPreço v3.0</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left;">
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">CÓD</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">DESCRIÇÃO</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">MARCA</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">UN</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">CX</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: right;">PREÇO UNIT (+ST)</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(p => {
              const catalogItem = catalogProducts?.find(cp => cp.id === p.catalogProductId);
              if (!catalogItem) return '';

              const basePrice = exportPriceType === 'closed' ? (catalogItem.closedLoadPrice || 0) : (catalogItem.fractionalLoadPrice || 0);
              const afterDiscount = Math.max(0, basePrice - (catalogItem.discountAmount || 0));
              
              const surchargeValue = p.customSurchargeValue !== undefined ? Number(p.customSurchargeValue) : (p.customSurchargeR$ || 0);
              const surchargeType = p.customSurchargeType || 'fixed';
              let withSurcharge = afterDiscount;
              if (surchargeType === 'percentage') withSurcharge += afterDiscount * (surchargeValue / 100);
              else withSurcharge += surchargeValue;

              const netPrice = withSurcharge * (1 + exportContractPercent / 100);
              const stRate = p.st ? parseFloat(p.st.replace('%', '').replace(',', '.')) / 100 : 0;
              const finalPrice = netPrice * (1 + stRate);

              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: bold;">${p.code}</td>
                  <td style="padding: 8px;">${p.description}</td>
                  <td style="padding: 8px;">${p.brand}</td>
                  <td style="padding: 8px;">${p.unit}</td>
                  <td style="padding: 8px;">${p.quantityPerBox}</td>
                  <td style="padding: 8px; text-align: right; font-weight: bold;">R$ ${finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 9px; color: #64748b;">
          <p>• Preço calculado para modalidade: <strong>${exportPriceType === 'closed' ? 'CARGA FECHADA' : 'CARGA FRACIONADA'}</strong></p>
          <p>• Condições comerciais: <strong>Cod: ${(exportContractPercent / 10).toFixed(1).replace('.', ',')}</strong> | Preços sujeitos a alteração conforme vigência no ato do faturamento.</p>
        </div>
      `;

      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`tabela_${factoryName.toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      
      document.body.removeChild(container);
      toast({ title: "Tabela Gerada", description: "O arquivo PDF foi baixado." });
      setShowExportConfigDialog(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro na exportação", description: "Ocorreu um erro ao gerar o PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
            <span className="text-xs font-bold text-muted-foreground hidden sm:inline-block">
              {user?.email?.split('@')[0].toUpperCase()} (ADMIN)
            </span>
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

          <Link href="/orders/grid" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-slate-800 text-white">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <LayoutGrid size={24} />
                </div>
                <CardTitle className="text-xl">Pedido em Grade (Desktop)</CardTitle>
                <CardDescription className="text-white/70">Preenchimento rápido em massa por fábrica e linha.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <div onClick={() => setShowExportConfigDialog(true)} className="group cursor-pointer">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-accent text-white">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <FileDown size={24} />
                </div>
                <CardTitle className="text-xl">Gerar Tabela PDF</CardTitle>
                <CardDescription className="text-white/70">Exporte catálogos de preços configuráveis.</CardDescription>
              </CardHeader>
            </Card>
          </div>

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

      {/* Export Dialog */}
      <Dialog open={showExportConfigDialog} onOpenChange={setShowExportConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Exportação PDF</DialogTitle>
            <DialogDescription>Selecione os filtros para a tabela de preços.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fábrica</Label>
              <Select value={exportFactoryId} onValueChange={(val) => { setExportFactoryId(val); setExportLineFilter("none"); setExportBrand("all"); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a fábrica" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linha</Label>
              <Select value={exportLineFilter} onValueChange={(val) => { setExportLineFilter(val); setExportBrand("all"); }} disabled={exportFactoryId === "none"}>
                <SelectTrigger><SelectValue placeholder="Selecione a linha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {Array.from(new Set(registeredProducts?.filter(p => p.factoryId === exportFactoryId).map(p => p.line).filter(Boolean) || [])).sort().map(line => (
                    <SelectItem key={line} value={line}>{line}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select value={exportBrand} onValueChange={setExportBrand} disabled={exportLineFilter === "none"}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Marcas</SelectItem>
                  {Array.from(new Set(registeredProducts?.filter(p => p.factoryId === exportFactoryId && p.line === exportLineFilter).map(p => p.brand).filter(Boolean) || [])).sort().map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Carga</Label>
                <Select value={exportPriceType} onValueChange={(val: any) => setExportPriceType(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Fechada</SelectItem>
                    <SelectItem value="fractional">Fracionada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aditivo (%)</Label>
                <Input type="number" value={exportContractPercent} onChange={(e) => setExportContractPercent(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportConfigDialog(false)}>Cancelar</Button>
            <Button onClick={handleExportPDF} disabled={isExporting} className="gap-2">
              {isExporting ? <Loader2 className="animate-spin" /> : <FileDown size={18} />} Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="py-6 border-t bg-white text-center">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          InteliPreço © {new Date().getFullYear()} - Sistema Inteligente de Pedidos
        </p>
      </footer>
    </div>
  );
}
