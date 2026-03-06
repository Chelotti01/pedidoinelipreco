
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useAuth } from '@/firebase';
import { collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Save, ReceiptText, ChevronLeft, Loader2, 
  Weight, Search, LayoutGrid, Package, AlertTriangle, Gift, DollarSign
} from "lucide-react";
import Link from 'next/link';

type OrderItem = {
  productId: string;
  catalogProductId: string;
  factoryName: string;
  code: string;
  name: string;
  ean: string;
  unit: string;
  quantity: number;
  priceType: 'closed' | 'fractional';
  unitPriceNet: number;
  unitPriceFinal: number;
  appliedContract: number;
  stRate: number;
  total: number;
  weight: number;
  line: string;
  quantityPerBox: number;
  unitWeight: number;
  isBonus?: boolean;
};

export default function GridOrderPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("none");
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("none");
  const [lineFilter, setLineFilter] = useState<string>("none");
  const [contractPercent, setContractPercent] = useState<number>(0);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [manualObservations, setManualObservations] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Estados para as quantidades e preços editáveis (por ID de produto registrado)
  const [gridQuantities, setGridQuantities] = useState<Record<string, number>>({});
  const [gridPricesFinal, setGridPricesFinal] = useState<Record<string, number>>({});
  const [gridPricesNet, setGridPricesNet] = useState<Record<string, number>>({});
  const [gridBonus, setGridBonus] = useState<Record<string, boolean>>({});

  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => query(collection(db, 'registered_products'), orderBy('description')), [db]);
  const { data: registeredProducts } = useCollection(registeredProductsQuery);

  const catalogProductsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products')), [db]);
  const { data: catalogProducts } = useCollection(catalogProductsQuery);

  const customersQuery = useMemoFirebase(() => query(collection(db, 'customers'), orderBy('name', 'asc')), [db]);
  const { data: customers } = useCollection(customersQuery);

  const availableLines = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts) return [];
    const lines = registeredProducts
      .filter(p => p.factoryId === selectedFactoryId)
      .map(p => p.line)
      .filter(Boolean);
    return Array.from(new Set(lines)).sort();
  }, [selectedFactoryId, registeredProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none" || lineFilter === "none" || !registeredProducts) return [];
    return registeredProducts.filter(p => 
      p.factoryId === selectedFactoryId && 
      p.line === lineFilter &&
      (searchTerm === "" || p.description.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [selectedFactoryId, lineFilter, registeredProducts, searchTerm]);

  const parseST = (stValue: string | undefined): number => {
    if (!stValue) return 0;
    const cleaned = stValue.replace('%', '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed / 100;
  };

  // Inicializar preços base quando mudar a fábrica/linha/contrato
  useEffect(() => {
    if (filteredProducts.length > 0 && catalogProducts) {
      const newPricesFinal: Record<string, number> = {};
      const newPricesNet: Record<string, number> = {};
      
      filteredProducts.forEach(p => {
        const catalogItem = catalogProducts.find(cp => cp.id === p.catalogProductId);
        if (catalogItem) {
          const basePrice = priceType === 'closed' ? (catalogItem.closedLoadPrice || 0) : (catalogItem.fractionalLoadPrice || 0);
          const afterCatalog = Math.max(0, basePrice - (catalogItem.discountAmount || 0));
          
          const surchargeValue = p.customSurchargeValue !== undefined ? Number(p.customSurchargeValue) : (p.customSurchargeR$ || 0);
          const surchargeType = p.customSurchargeType || 'fixed';
          
          let withSurcharge = afterCatalog;
          if (surchargeType === 'percentage') withSurcharge += afterCatalog * (surchargeValue / 100);
          else withSurcharge += surchargeValue;
          
          const netPrice = withSurcharge * (1 + contractPercent / 100);
          const stRate = parseST(p.st);
          const finalPrice = netPrice * (1 + stRate);
          
          newPricesFinal[p.id] = finalPrice;
          newPricesNet[p.id] = netPrice;
        }
      });
      
      setGridPricesFinal(newPricesFinal);
      setGridPricesNet(newPricesNet);
    }
  }, [filteredProducts, catalogProducts, priceType, contractPercent]);

  const handleUpdatePriceFinal = (productId: string, val: number, stRateStr: string) => {
    const stRate = parseST(stRateStr);
    const netPrice = val / (1 + stRate);
    setGridPricesFinal(prev => ({ ...prev, [productId]: val }));
    setGridPricesNet(prev => ({ ...prev, [productId]: netPrice }));
  };

  const handleUpdatePriceNet = (productId: string, val: number, stRateStr: string) => {
    const stRate = parseST(stRateStr);
    const finalPrice = val * (1 + stRate);
    setGridPricesNet(prev => ({ ...prev, [productId]: val }));
    setGridPricesFinal(prev => ({ ...prev, [productId]: finalPrice }));
  };

  const orderItems = useMemo(() => {
    const items: OrderItem[] = [];
    const factoryName = factories?.find(f => f.id === selectedFactoryId)?.name || "Fábrica";

    Object.entries(gridQuantities).forEach(([productId, qty]) => {
      if (qty <= 0) return;
      
      const p = registeredProducts?.find(rp => rp.id === productId);
      if (!p) return;

      const isBonus = gridBonus[productId] || false;
      const finalPrice = gridPricesFinal[productId] || 0;
      const netPrice = gridPricesNet[productId] || 0;
      const qtyPerBox = p.quantityPerBox || 1;
      const stRate = parseST(p.st);

      items.push({
        productId: p.id,
        catalogProductId: p.catalogProductId || "",
        factoryName,
        code: p.code,
        name: p.description,
        ean: p.ean || "",
        unit: p.unit,
        quantity: qty,
        priceType,
        unitPriceNet: netPrice,
        unitPriceFinal: finalPrice,
        appliedContract: contractPercent,
        stRate: stRate * 100,
        total: isBonus ? 0 : (finalPrice * qtyPerBox * qty),
        weight: isBonus ? 0 : ((p.boxWeightKg || 0) * qty),
        line: p.line || "",
        quantityPerBox: qtyPerBox,
        unitWeight: p.boxWeightKg || 0,
        isBonus
      });
    });

    return items;
  }, [gridQuantities, gridPricesFinal, gridPricesNet, gridBonus, registeredProducts, selectedFactoryId, factories, priceType, contractPercent]);

  const orderTotal = useMemo(() => orderItems.reduce((acc, item) => acc + item.total, 0), [orderItems]);
  const orderTotalWeight = useMemo(() => orderItems.reduce((acc, item) => acc + item.weight, 0), [orderItems]);

  const bonusSummaries = useMemo(() => {
    if (orderItems.length === 0) return [];
    const grouped: Record<string, { saleQty: number, bonusQty: number, totalVal: number, name: string, qtyPerBox: number }> = {};

    orderItems.forEach(item => {
      const key = `${item.productId}-${item.priceType}`;
      if (!grouped[key]) grouped[key] = { saleQty: 0, bonusQty: 0, totalVal: 0, name: item.name, qtyPerBox: item.quantityPerBox };
      if (item.isBonus) grouped[key].bonusQty += item.quantity;
      else { grouped[key].saleQty += item.quantity; grouped[key].totalVal += item.total; }
    });

    return Object.values(grouped)
      .filter(g => g.saleQty > 0 && g.bonusQty > 0)
      .map(g => `• ${g.name}: Preço unitário médio com bônus: R$ ${(g.totalVal / ((g.saleQty + g.bonusQty) * g.qtyPerBox)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }, [orderItems]);

  const handleProcessOrder = async (status: 'DRAFT' | 'CONFIRMED') => {
    if (orderItems.length === 0) {
      toast({ title: "Pedido vazio", description: "Informe quantidades em pelo menos um item.", variant: "destructive" });
      return;
    }
    if (selectedCustomerId === "none") {
      toast({ title: "Cliente obrigatório", description: "Selecione um cliente.", variant: "destructive" });
      return;
    }

    if (status === 'CONFIRMED') {
      const totalQty = orderItems.reduce((acc, item) => acc + item.quantity, 0);
      const factoryName = factories?.find(f => f.id === selectedFactoryId)?.name?.toUpperCase() || '';
      const line = lineFilter.toUpperCase();

      if (factoryName.includes('ARA') && line.includes('SECA UHT') && totalQty < 30) {
        toast({ title: "Mínimo ARA", description: "Mínimo de 30 caixas para esta linha.", variant: "destructive" });
        return;
      }
    }

    status === 'DRAFT' ? setIsSavingDraft(true) : setIsFinalizing(true);

    let finalNotes = manualObservations;
    if (bonusSummaries.length > 0) finalNotes += `\n\n--- RESUMO BONIFICAÇÃO ---\n${bonusSummaries.join('\n')}`;

    const orderData = {
      customerId: selectedCustomerId,
      customerName: customers?.find(c => c.id === selectedCustomerId)?.name || 'Cliente',
      items: orderItems,
      notes: finalNotes,
      totalAmount: orderTotal,
      totalWeight: orderTotalWeight,
      status,
      createdAt: serverTimestamp(),
      userId: auth.currentUser?.uid || 'anonymous'
    };

    try {
      await addDocumentNonBlocking(collection(db, 'orders'), orderData);
      toast({ title: status === 'DRAFT' ? "Rascunho Salvo" : "Pedido Finalizado", description: "Sucesso!" });
      router.push('/orders/history');
    } catch (e) {
      toast({ title: "Erro", description: "Tente novamente.", variant: "destructive" });
      status === 'DRAFT' ? setIsSavingDraft(false) : setIsFinalizing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-primary flex items-center gap-2">
              <LayoutGrid size={24} /> Pedido em Grade (Desktop)
            </h1>
            <p className="text-sm text-muted-foreground">Preencha quantidades e valores em massa.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-sm border-none bg-accent/5">
          <CardHeader className="py-3"><Label className="text-xs uppercase font-bold">Cliente</Label></CardHeader>
          <CardContent>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-primary/5">
          <CardHeader className="py-3"><Label className="text-xs uppercase font-bold">Fábrica / Linha</Label></CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedFactoryId} onValueChange={(v) => { setSelectedFactoryId(v); setLineFilter("none"); setGridQuantities({}); }}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Fábrica" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {factories?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={lineFilter} onValueChange={(v) => { setLineFilter(v); setGridQuantities({}); }} disabled={selectedFactoryId === "none"}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Linha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {availableLines.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-primary/5">
          <CardHeader className="py-3"><Label className="text-xs uppercase font-bold">Condições</Label></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Carga</Label>
                <Select value={priceType} onValueChange={(v: any) => setPriceType(v)}>
                  <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Fechada</SelectItem>
                    <SelectItem value="fractional">Fracionada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Aditivo %</Label>
                <Input type="number" value={contractPercent} onChange={(e) => setContractPercent(Number(e.target.value))} className="h-9 text-xs bg-white font-bold" />
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input placeholder="Buscar no grid..." className="pl-8 h-9 text-xs bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary text-white border-none shadow-md">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold uppercase opacity-80">Total Pedido</span>
              <ShoppingCart size={20} />
            </div>
            <div className="text-2xl font-black">R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs font-medium opacity-80 mt-2 flex items-center gap-1">
              <Weight size={14} /> {orderTotalWeight.toFixed(2)} Kg total
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl overflow-hidden mb-24">
        {selectedFactoryId === "none" || lineFilter === "none" ? (
          <div className="p-20 text-center text-muted-foreground bg-white">
            <Package size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">Selecione Fábrica e Linha para carregar a grade de produtos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead className="w-[80px]">Bônus</TableHead>
                  <TableHead>Cód / Descrição</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-center">Cx/Und</TableHead>
                  <TableHead className="text-right">Net R$</TableHead>
                  <TableHead className="text-right">Final (+ST) R$</TableHead>
                  <TableHead className="text-center w-[120px]">Qtd (Cxs)</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {filteredProducts.map((p) => {
                  const isB = gridBonus[p.id] || false;
                  const qty = gridQuantities[p.id] || 0;
                  const net = gridPricesNet[p.id] || 0;
                  const fin = gridPricesFinal[p.id] || 0;
                  const subtotal = isB ? 0 : (fin * (p.quantityPerBox || 1) * qty);

                  return (
                    <TableRow key={p.id} className={`${qty > 0 ? "bg-primary/5" : ""} hover:bg-slate-50 transition-colors`}>
                      <TableCell className="text-center">
                        <button 
                          onClick={() => setGridBonus(prev => ({ ...prev, [p.id]: !isB }))}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border-2 ${isB ? "bg-accent border-accent text-white" : "bg-white border-slate-200 text-slate-300"}`}
                          title="Marcar como Bonificação"
                        >
                          <Gift size={18} />
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-xs uppercase">{p.code}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[250px] uppercase font-medium">{p.description}</div>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold text-slate-600">{p.brand}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{p.quantityPerBox} {p.unit}</TableCell>
                      <TableCell className="text-right">
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="w-20 h-8 text-right text-[11px] font-bold border-slate-200" 
                          value={net.toFixed(2)}
                          onChange={(e) => handleUpdatePriceNet(p.id, Number(e.target.value), p.st)}
                          disabled={isB}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <Input 
                            type="number" 
                            step="0.01" 
                            className={`w-24 h-8 text-right text-xs font-black border-primary/20 ${isB ? "opacity-50 line-through" : "text-primary bg-primary/5"}`}
                            value={fin.toFixed(2)}
                            onChange={(e) => handleUpdatePriceFinal(p.id, Number(e.target.value), p.st)}
                            disabled={isB}
                          />
                          <span className="text-[9px] text-destructive font-bold">ST: {p.st}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input 
                          type="number" 
                          className={`w-20 h-10 text-center font-black text-lg ${qty > 0 ? "border-primary ring-1 ring-primary" : "border-slate-200"}`}
                          value={qty === 0 ? "" : qty}
                          onChange={(e) => setGridQuantities(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                          onFocus={(e) => e.target.select()}
                        />
                      </TableCell>
                      <TableCell className={`text-right font-black ${isB ? "text-accent" : "text-slate-800"}`}>
                        {isB ? "BONUS" : `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-8px_30px_rgba(0,0,0,0.1)] p-6 z-50">
        <div className="container mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-8 items-center">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Resumo do Pedido</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-primary">R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className="text-sm font-bold text-muted-foreground">({orderTotalWeight.toFixed(2)} Kg)</span>
              </div>
            </div>
            <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />
            <div className="hidden lg:block max-w-xs">
              <Label className="text-[10px] font-bold uppercase opacity-60">Observações Rápidas</Label>
              <Textarea 
                placeholder="Notas de entrega..." 
                className="h-10 min-h-0 py-1 text-xs resize-none" 
                value={manualObservations} 
                onChange={(e) => setManualObservations(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <Button variant="outline" className="h-14 px-8 border-slate-300 font-bold" onClick={() => setGridQuantities({})} disabled={isFinalizing || isSavingDraft}>Limpar Grade</Button>
            <Button variant="secondary" className="h-14 px-8 font-bold gap-2 text-lg" onClick={() => handleProcessOrder('DRAFT')} disabled={isFinalizing || isSavingDraft || selectedCustomerId === "none"}>
              {isSavingDraft ? <Loader2 className="animate-spin" /> : <Save size={20} />} Rascunho
            </Button>
            <Button className="h-14 px-12 bg-primary hover:bg-primary/90 text-white shadow-lg gap-2 text-lg font-bold" onClick={() => handleProcessOrder('CONFIRMED')} disabled={isFinalizing || isSavingDraft || selectedCustomerId === "none"}>
              {isFinalizing ? <Loader2 className="animate-spin" /> : <ReceiptText size={20} />} Finalizar Pedido
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
