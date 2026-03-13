
"use client"

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  ShoppingCart, ListChecks, Zap, History, Users, LogOut, 
  Package, FileSpreadsheet, FileDown, Loader2, LayoutGrid, 
  DollarSign, TrendingUp, Settings, ChevronDown, ChevronUp, ShieldCheck, UploadCloud, Lock, Info, Eye, EyeOff, Type, Diff
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

const PRICE_TABLE_CATEGORIES = [
  { name: "LEITES PIRACANJUBA", codes: ["10317", "10318", "10319"] },
  { name: "LEITES PIRACANJUBA ZERO LACTOSE", codes: ["12409", "12411", "12438"] },
  { name: "LEITES PIRACANJUBA ESPECIAIS", codes: ["10326", "10327", "10328", "12436"] },
  { name: "LEITES NESTLE", codes: ["502429", "502431", "502433"] },
  { name: "LEITES NESTLE ZERO LACTOSE", codes: ["502430", "502432", "502434", "502435", "502439"] },
  { name: "LEITE EM PÓ ALMOFADA", codes: ["10206", "10218", "10230", "10204", "10217", "10229", "10211", "10219"] },
  { name: "LEITE EM PÓ POUCH", codes: ["10238", "10239", "10240"] },
  { name: "LEITE EM PÓ PRODUÇÃO 25KG", codes: ["10201", "10202"] },
  { name: "LEITE EM PÓ LATA", codes: ["10271", "10299", "10200", "10222", "10223", "10283", "10284", "10295"] },
  { name: "COMPOSTO LÁCTEO ÓTIMO", codes: ["200222", "200223", "200254", "200255"] },
  { name: "CREME DE LEITE", codes: ["12201", "12218", "12219", "12220", "12221"] },
  { name: "LEITE CONDENSADO", codes: ["12301", "12307", "12320", "12332", "12333", "12334", "12335", "12603"] },
  { name: "BEBIDAS LÁCTEAS PIRAKIDS", codes: ["12003", "12016", "12017", "12019"] },
  { name: "PROFORCE 250ML 23g", codes: ["12026", "12027", "12557", "12559", "12564"] },
  { name: "PROFORCE 250ML 15g", codes: ["12572", "12573", "12574", "12575", "12576", "12591"] },
  { name: "BEBIDA LÁCTEA MILKYMOO 250ML 15g", codes: ["12579", "12590"] },
  { name: "BEBIDA LÁCTEA ZQUAD 250ML 10g", codes: ["12587", "12588", "12589"] },
  { name: "WHEY EM PÓ 450g", codes: ["12577", "12578"] },
  { name: "BEBIDAS LÁCTEAS QLC", codes: ["12509", "12513", "12521", "12547"] },
  { name: "BEBIDA ALMOND BREEZE", codes: ["272800", "272801", "272802", "272807", "272809", "272810", "272813"] },
  { name: "QUEIJO RALADO", codes: ["11104", "11105"] },
  { name: "MANTEIGAS", codes: ["10417", "10401", "10402", "10405", "10418", "10419", "10421"] },
  { name: "QUEIJOS", codes: ["10601", "10602", "10605", "10606", "10901", "10903", "11001", "11005", "11010", "11013", "11014", "11017", "11028", "11023", "11101", "11119", "11118", "11201", "11204", "11216", "11226", "11503", "11519", "11509", "11510", "11520", "11607", "11608", "11609", "11610"] },
  { name: "SUPLEMENTOS ALIMENTARES EMANA", codes: ["322500", "322502", "322503", "322504", "323101", "323102", "323103", "323104", "323105", "323106", "323107", "323108", "323109", "323110", "323111", "323112", "323201", "323202", "323203", "323301", "323302", "323303", "323304", "323305", "323306", "323307", "323308", "323309", "323310", "323311", "323312", "323313", "323314", "323315", "323316", "323317", "323318", "323319", "323324", "323325", "323326", "323327", "323328", "323329", "323336", "323338", "323342", "323343"] }
];

export default function Home() {
  const auth = useAuth();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [showConfigs, setShowConfigs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportConfigDialog, setShowExportConfigDialog] = useState(false);
  
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [isConfigsUnlocked, setIsConfigsUnlocked] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const isSuperAdmin = useMemo(() => {
    return user?.email === 'vendas.piracanjuba@gmail.com' || profile?.role === 'superAdmin';
  }, [user, profile]);

  const orgId = profile?.organizationId;

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

  const [exportFactoryId, setExportFactoryId] = useState<string>("none");
  const [exportLineFilter, setExportLineFilter] = useState<string>("none");
  const [exportContractPercent, setExportContractPercent] = useState<number>(0);
  const [exportPriceType, setExportPriceType] = useState<'closed' | 'fractional'>('closed');
  const [exportBrand, setExportBrand] = useState<string>("all");
  const [exportIncludeEan, setExportIncludeEan] = useState(false);
  const [exportIncludeNetUnit, setExportIncludeNetUnit] = useState(true);
  const [exportIncludeFinalUnit, setExportIncludeFinalUnit] = useState(true);
  const [exportIncludeNetBox, setExportIncludeNetBox] = useState(false);
  const [exportIncludeFinalBox, setExportIncludeFinalBox] = useState(false);

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
    if (inputPassword === 'admin123') {
      setIsConfigsUnlocked(true);
      setShowConfigs(true);
      setShowPasswordDialog(false);
      setInputPassword("");
      toast({ title: "Acesso liberado" });
    } else {
      toast({ title: "Senha incorreta", variant: "destructive" });
    }
  };

  const handleExportPDF = async () => {
    if (exportFactoryId === "none" || exportLineFilter === "none" || !orgId) {
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
      ) || []);

      if (filtered.length === 0) {
        toast({ title: "Nenhum item encontrado", description: "Verifique os filtros selecionados.", variant: "destructive" });
        setIsExporting(false);
        return;
      }

      const displayRows: any[] = [];
      PRICE_TABLE_CATEGORIES.forEach(cat => {
        const catProducts = filtered.filter(p => cat.codes.includes(String(p.code)));
        if (catProducts.length > 0) {
          displayRows.push({ type: 'header', name: cat.name });
          catProducts.sort((a, b) => cat.codes.indexOf(String(a.code)) - cat.codes.indexOf(String(b.code)));
          catProducts.forEach(p => displayRows.push({ type: 'product', data: p }));
        }
      });

      const categorizedCodes = PRICE_TABLE_CATEGORIES.flatMap(c => c.codes);
      const otherProducts = filtered.filter(p => !categorizedCodes.includes(String(p.code)));
      if (otherProducts.length > 0) {
        displayRows.push({ type: 'header', name: 'OUTROS ITENS' });
        otherProducts.sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
        otherProducts.forEach(p => displayRows.push({ type: 'product', data: p }));
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const itemsPerPage = 24; 
      const totalPages = Math.ceil(displayRows.length / itemsPerPage);
      const factoryName = factories?.find(f => f.id === exportFactoryId)?.name || 'Fábrica';
      
      const typeShorthand = exportPriceType === 'closed' ? 'fe' : 'fr';
      const formattedPercent = exportPriceType === 'closed' 
        ? (exportContractPercent / 10).toString().replace('.', ',')
        : (exportContractPercent < 10 ? `0${exportContractPercent}` : exportContractPercent);
      const footerCode = `${typeShorthand} ${formattedPercent}`;

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = displayRows.slice(start, end);

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '210mm';
        container.style.height = '297mm'; 
        container.style.backgroundColor = 'white';
        container.style.padding = '15mm 15mm 10mm 15mm'; 
        container.style.boxSizing = 'border-box';

        const rowsHtml = pageItems.map(row => {
          if (row.type === 'header') {
            return `
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <td colspan="10" style="padding: 6px 8px; font-weight: 900; font-size: 10px; color: #4582A1; text-transform: uppercase; font-family: sans-serif;">${row.name}</td>
              </tr>
            `;
          }

          const p = row.data;
          const catalogItem = catalogProducts?.find(cp => cp.id === p.catalogProductId);
          if (!catalogItem) return '';

          const basePrice = exportPriceType === 'closed' ? (catalogItem.closedLoadPrice || 0) : (catalogItem.fractionalLoadPrice || 0);
          const afterCatalog = Math.max(0, basePrice - (catalogItem.discountAmount || 0));
          const surchargeValue = p.customSurchargeValue !== undefined ? Number(p.customSurchargeValue) : (p.customSurchargeR$ || 0);
          const surchargeType = p.customSurchargeType || 'fixed';
          let withSurcharge = afterCatalog;
          if (surchargeType === 'percentage') withSurcharge += afterCatalog * (surchargeValue / 100);
          else withSurcharge += surchargeValue;

          const netPrice = withSurcharge * (1 + exportContractPercent / 100);
          const stRate = p.st ? parseFloat(p.st.replace('%', '').replace(',', '.')) / 100 : 0;
          const finalPrice = netPrice * (1 + stRate);
          const qtyPerBox = Number(p.quantityPerBox) || 1;

          const priceStyle = 'padding: 8px; text-align: right; font-family: Arial, sans-serif; font-size: 11pt;';

          return `
            <tr style="border-bottom: 1px solid #E0E0E0;">
              <td style="padding: 8px; font-weight: bold; width: 60px; font-family: Arial, sans-serif; font-size: 9pt;">${p.code}</td>
              <td style="padding: 8px; font-size: 8px; text-transform: uppercase; font-family: sans-serif; max-width: 200px;">${p.description}</td>
              <td style="padding: 8px; text-align: center; width: 30px; font-size: 8px;">${p.unit}</td>
              ${exportIncludeEan ? `<td style="padding: 8px; font-size: 8px; font-family: monospace; color: #64748b;">${p.ean || '-'}</td>` : ''}
              ${exportIncludeNetUnit ? `<td style="${priceStyle}">${netPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
              ${exportIncludeFinalUnit ? `<td style="${priceStyle} font-weight: bold; color: #4582A1;">${finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
              ${exportIncludeNetBox ? `<td style="${priceStyle} color: #64748b;">${(netPrice * qtyPerBox).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
              ${exportIncludeFinalBox ? `<td style="${priceStyle} font-weight: bold; color: #059669;">${(finalPrice * qtyPerBox).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
            </tr>
          `;
        }).join('');

        container.innerHTML = `
          <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="border-bottom: 3px solid #4582A1; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h1 style="margin: 0; color: #4582A1; font-size: 24px; font-weight: 900; font-family: Arial, sans-serif;">TABELA DE PREÇOS</h1>
                <p style="margin: 5px 0 0 0; color: #64748b; font-family: sans-serif; font-size: 14px; font-weight: bold;">${factoryName} - ${exportLineFilter}</p>
              </div>
              <div style="text-align: right; font-family: sans-serif;">
                <p style="margin: 0; font-weight: bold; font-size: 12px; color: #4582A1; text-transform: uppercase;">${orgId}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">Página ${page + 1} de ${totalPages}</p>
              </div>
            </div>
            <div style="flex-grow: 1;">
              <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
                <thead style="background-color: #F0F3F4;">
                  <tr>
                    <th style="padding: 10px 8px; text-align: left; font-size: 8px; font-weight: 900;">CÓD</th>
                    <th style="padding: 10px 8px; text-align: left; font-size: 8px; font-weight: 900;">DESCRIÇÃO</th>
                    <th style="padding: 10px 8px; text-align: center; font-size: 8px; font-weight: 900;">UND</th>
                    ${exportIncludeEan ? '<th style="padding: 10px 8px; text-align: left; font-size: 8px; font-weight: 900;">EAN</th>' : ''}
                    ${exportIncludeNetUnit ? '<th style="padding: 10px 8px; text-align: right; font-size: 8px; font-weight: 900;">UNIT. NET</th>' : ''}
                    ${exportIncludeFinalUnit ? '<th style="padding: 10px 8px; text-align: right; font-size: 8px; font-weight: 900;">UNIT. FINAL</th>' : ''}
                    ${exportIncludeNetBox ? '<th style="padding: 10px 8px; text-align: right; font-size: 8px; font-weight: 900;">CX. NET</th>' : ''}
                    ${exportIncludeFinalBox ? '<th style="padding: 10px 8px; text-align: right; font-size: 8px; font-weight: 900;">CX. FINAL</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
            <div style="margin-top: auto; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <p style="font-size: 8px; color: #94a3b8; font-family: Arial, sans-serif; margin: 0;">Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}. Preços sujeitos a alteração sem aviso prévio.</p>
              <p style="font-size: 9px; font-weight: normal; color: #cbd5e1; font-family: Arial, sans-serif; margin: 0; text-transform: uppercase;">COD: ${footerCode}</p>
            </div>
          </div>
        `;

        document.body.appendChild(container);
        const canvas = await html2canvas(container, { scale: 2, useCORS: true });
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
        document.body.removeChild(container);
      }

      pdf.save(`tabela_${factoryName.toLowerCase().replace(/\s+/g, '_')}_${exportLineFilter.toLowerCase().replace(/\s+/g, '_')}.pdf`);
      setShowExportConfigDialog(false);
      toast({ title: "Tabela gerada com sucesso!" });
    } catch (e) {
      console.error(e);
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
              <p className="text-xs font-black uppercase text-primary leading-none">{orgId || 'Visitante'}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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

          <Link href="/comparison" className="group">
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-white">
              <CardHeader>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                  <Diff size={24} />
                </div>
                <CardTitle className="text-xl">Comparação</CardTitle>
                <CardDescription>Compare preços entre fábricas.</CardDescription>
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
            <Card className="h-full border-none shadow-md hover:shadow-xl transition-all hover:-translate-y-1 bg-white">
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

      <Dialog open={showExportConfigDialog} onOpenChange={setShowExportConfigDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Exportação PDF</DialogTitle>
            <DialogDescription>Selecione a fábrica e as colunas de preço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
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
                <Label>Contrato (%)</Label>
                <Input 
                  type="number" 
                  value={exportContractPercent} 
                  onChange={(e) => setExportContractPercent(Number(e.target.value))} 
                  onFocus={(e) => e.target.select()} 
                  onWheel={(e) => e.currentTarget.blur()} 
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">Colunas no PDF</Label>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Código de Barras</Label>
                    <p className="text-[10px] text-muted-foreground">Incluir coluna EAN</p>
                  </div>
                  <Switch checked={exportIncludeEan} onCheckedChange={setExportIncludeEan} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Unitário NET</Label>
                    <p className="text-[10px] text-muted-foreground">Preço antes da ST</p>
                  </div>
                  <Switch checked={exportIncludeNetUnit} onCheckedChange={setExportIncludeNetUnit} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-primary">Unitário Final (+ST)</Label>
                    <p className="text-[10px] text-muted-foreground">Preço final com impostos</p>
                  </div>
                  <Switch checked={exportIncludeFinalUnit} onCheckedChange={setExportIncludeFinalUnit} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Caixa NET</Label>
                    <p className="text-[10px] text-muted-foreground">Valor da caixa sem ST</p>
                  </div>
                  <Switch checked={exportIncludeNetBox} onCheckedChange={setExportIncludeNetBox} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-emerald-600">Caixa Final (+ST)</Label>
                    <p className="text-[10px] text-muted-foreground">Valor total da caixa com impostos</p>
                  </div>
                  <Switch checked={exportIncludeFinalBox} onCheckedChange={setExportIncludeFinalBox} />
                </div>
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
