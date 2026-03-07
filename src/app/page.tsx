
"use client"

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  ShoppingCart, ListChecks, Zap, History, Users, LogOut, 
  Package, FileSpreadsheet, FileDown, Loader2, LayoutGrid, 
  DollarSign, TrendingUp, Settings, ChevronDown, ChevronUp, ShieldCheck, UploadCloud, Lock, Info, Eye, EyeOff
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Home() {
  const auth = useAuth();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [showConfigs, setShowConfigs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportConfigDialog, setShowExportConfigDialog] = useState(false);
  
  // Segurança das Configurações
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [isConfigsUnlocked, setIsConfigsUnlocked] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Perfil do Usuário para obter a Organização
  const userProfileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  // Verificação de Super Admin (Seu email ou role superAdmin)
  const isSuperAdmin = useMemo(() => {
    return user?.email === 'vendas.piracanjuba@gmail.com' || profile?.role === 'superAdmin';
  }, [user, profile]);

  const orgId = profile?.organizationId;

  // Consultas baseadas na Organização
  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null
  , [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'products'), orderBy('description')) : null
  , [db, orgId]);
  const { data: registeredProducts } = useCollection(registeredProductsQuery);

  const catalogQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices')) : null
  , [db, orgId]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  // Configurações de Exportação
  const [exportFactoryId, setExportFactoryId] = useState<string>("none");
  const [exportLineFilter, setExportLineFilter] = useState<string>("none");
  const [exportContractPercent, setExportContractPercent] = useState<number>(0);
  const [exportPriceType, setExportPriceType] = useState<'closed' | 'fractional'>('closed');
  const [exportBrand, setExportBrand] = useState<string>("all");
  const [exportIncludeNetUnit, setExportIncludeNetUnit] = useState(true);
  const [exportIncludeFinalUnit, setExportIncludeFinalUnit] = useState(true);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  const handleToggleConfigs = () => {
    if (showConfigs) {
      setShowConfigs(false);
    } else {
      if (isConfigsUnlocked) {
        setShowConfigs(true);
      } else {
        setShowPasswordDialog(true);
      }
    }
  };

  const handleUnlockConfigs = () => {
    // SENHA PADRÃO: admin123
    if (inputPassword === 'admin123') {
      setIsConfigsUnlocked(true);
      setShowConfigs(true);
      setShowPasswordDialog(false);
      setInputPassword("");
      toast({ title: "Acesso liberado" });
    } else {
      toast({ 
        title: "Senha incorreta", 
        description: "A senha digitada não confere.", 
        variant: "destructive" 
      });
    }
  };

  const handleExportPDF = async () => {
    if (exportFactoryId === "none" || exportLineFilter === "none") {
      toast({ title: "Filtros incompletos", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const filtered = (registeredProducts?.filter(p => 
        p.factoryId === exportFactoryId && 
        p.line === exportLineFilter &&
        (exportBrand === "all" || p.brand === exportBrand)
      ) || []).sort((a, b) => (a.brand || "").localeCompare(b.brand || "") || (a.code || "").localeCompare(b.code || ""));

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.backgroundColor = 'white';
      container.style.padding = '15mm';

      const factoryName = factories?.find(f => f.id === exportFactoryId)?.name || 'Fábrica';
      
      container.innerHTML = `
        <div style="border-bottom: 3px solid #4582A1; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between;">
          <div>
            <h1 style="margin: 0; color: #4582A1; font-size: 24px; font-weight: 900;">TABELA DE PREÇOS</h1>
            <p style="margin: 5px 0 0 0; color: #64748b;">${factoryName} - ${exportLineFilter}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: bold; font-size: 12px;">InteliPreço SaaS</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">Emissão: ${format(new Date(), "dd/MM/yyyy")}</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead style="background-color: #F0F3F4;">
            <tr>
              <th style="padding: 8px; text-align: left;">CÓD</th>
              <th style="padding: 8px; text-align: left;">DESCRIÇÃO</th>
              ${exportIncludeNetUnit ? '<th style="padding: 8px; text-align: right;">UNIT. NET</th>' : ''}
              ${exportIncludeFinalUnit ? '<th style="padding: 8px; text-align: right;">UNIT. FINAL</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${filtered.map(p => {
              const catalogItem = catalogProducts?.find(cp => cp.productId === p.catalogProductId);
              if (!catalogItem) return '';
              const basePrice = exportPriceType === 'closed' ? (catalogItem.closedLoadPrice || 0) : (catalogItem.fractionalLoadPrice || 0);
              const netPrice = (basePrice - (catalogItem.discountAmount || 0)) * (1 + exportContractPercent / 100);
              const finalPrice = netPrice * (1 + (p.st ? parseFloat(p.st) / 100 : 0));
              return `
                <tr style="border-bottom: 1px solid #E0E0E0;">
                  <td style="padding: 8px; font-weight: bold;">${p.code}</td>
                  <td style="padding: 8px;">${p.description}</td>
                  ${exportIncludeNetUnit ? `<td style="padding: 8px; text-align: right;">R$ ${netPrice.toFixed(2)}</td>` : ''}
                  ${exportIncludeFinalUnit ? `<td style="padding: 8px; text-align: right; font-weight: bold; color: #4582A1;">R$ ${finalPrice.toFixed(2)}</td>` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`tabela_${factoryName.toLowerCase()}.pdf`);
      document.body.removeChild(container);
      setShowExportConfigDialog(false);
    } catch (e) {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (isProfileLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

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
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black uppercase text-primary leading-none">{profile?.organizationId || 'Visitante'}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-800">Painel de Controle</h2>
            <p className="text-muted-foreground">Bem-vindo, {profile?.name || 'usuário'}.</p>
          </div>
          {isSuperAdmin && (
            <Link href="/super-admin">
              <Button variant="outline" className="gap-2 border-primary text-primary font-bold shadow-sm hover:bg-primary/5">
                <ShieldCheck size={18} /> Área Super Admin
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/orders/new" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-primary text-white">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <ShoppingCart size={24} />
                </div>
                <CardTitle className="text-xl">Novo Pedido</CardTitle>
                <CardDescription className="text-white/70">Emissão rápida com preços dinâmicos.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/orders/grid" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-slate-800 text-white">
              <CardHeader>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <LayoutGrid size={24} />
                </div>
                <CardTitle className="text-xl">Grade Desktop</CardTitle>
                <CardDescription className="text-white/70">Preenchimento em massa por fábrica.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <div onClick={() => setShowExportConfigDialog(true)} className="group cursor-pointer">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-white border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                  <FileDown size={24} />
                </div>
                <CardTitle className="text-xl">Gerar Tabela PDF</CardTitle>
                <CardDescription>Exporte catálogos de preços configuráveis.</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Link href="/orders/history" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                  <History size={24} />
                </div>
                <CardTitle className="text-xl">Meus Pedidos</CardTitle>
                <CardDescription>Consulte e exporte orçamentos realizados.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* SEÇÃO DE CONFIGURAÇÕES AGRUPADA */}
        <div className="mt-12">
          <button 
            onClick={handleToggleConfigs}
            className="w-full flex items-center justify-between p-6 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                <Settings size={24} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-800">Configurações do Sistema</h3>
                  {!isConfigsUnlocked && <Lock size={16} className="text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground">Gerencie cadastros, produtos e base de clientes.</p>
              </div>
            </div>
            {showConfigs ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>

          {showConfigs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
              <Link href="/upload">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full border-2 border-dashed bg-primary/5">
                  <CardHeader>
                    <UploadCloud size={20} className="text-primary mb-2" />
                    <CardTitle className="text-lg">Importar Fábrica</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Atualize os preços via planilha XLSX.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/catalog">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <Package size={20} className="text-blue-500 mb-2" />
                    <CardTitle className="text-lg">Catálogo de Fábrica</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Produtos e preços brutos importados.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/products">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <ListChecks size={20} className="text-orange-500 mb-2" />
                    <CardTitle className="text-lg">Produtos Registrados</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Cadastro paralelo e amarração de preços.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/customers">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <Users size={20} className="text-green-500 mb-2" />
                    <CardTitle className="text-lg">Base de Clientes</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Gerencie seus clientes e prazos.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/products/margins">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full bg-accent/5">
                  <CardHeader>
                    <TrendingUp size={20} className="text-accent mb-2" />
                    <CardTitle className="text-lg">Ajustar Margens</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Ajuste aditivos de rentabilidade.</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={20} className="text-primary" /> Acesso Restrito
            </DialogTitle>
            <DialogDescription>
              Digite a senha de administrador para acessar as configurações do sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha de Administrador</Label>
              <div className="relative">
                <Input 
                  id="admin-password"
                  type={showAdminPassword ? "text" : "password"} 
                  placeholder="Digite a senha..." 
                  value={inputPassword} 
                  onChange={(e) => setInputPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockConfigs()}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
            <Button onClick={handleUnlockConfigs}>Desbloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportConfigDialog} onOpenChange={setShowExportConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Exportação PDF</DialogTitle>
            <DialogDescription>Selecione a fábrica e as colunas de preço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fábrica</Label>
              <Select value={exportFactoryId} onValueChange={(val) => { setExportFactoryId(val); setExportLineFilter("none"); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linha</Label>
              <Select value={exportLineFilter} onValueChange={setExportLineFilter} disabled={exportFactoryId === "none"}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {Array.from(new Set(registeredProducts?.filter(p => p.factoryId === exportFactoryId).map(p => p.line).filter(Boolean) || [])).sort().map(line => (
                    <SelectItem key={line} value={line}>{line}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carga</Label>
                <Select value={exportPriceType} onValueChange={(val: any) => setExportPriceType(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Fechada</SelectItem>
                    <SelectItem value="fractional">Fracionada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aditivo %</Label>
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
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
          Pedido InteliPreço SaaS © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
