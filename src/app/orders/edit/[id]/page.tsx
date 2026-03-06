
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useAuth, useDoc } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Trash2, Calculator, ReceiptText, Zap, 
  Loader2, Weight, User, AlertTriangle, Search, Settings2, Minus, Save, Gift, ArrowLeft, Edit
} from "lucide-react";
import Link from 'next/link';
import { OrderItem } from '@/app/orders/new/page';

export default function EditOrderPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const orderRef = useMemoFirebase(() => id ? doc(db, 'orders', id) : null, [db, id]);
  const { data: order, isLoading: isOrderLoading } = useDoc(orderRef);
  
  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories, isLoading: isFactoriesLoading } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => query(collection(db, 'registered_products'), orderBy('description')), [db]);
  const { data: registeredProducts, isLoading: isRegisteredLoading } = useCollection(registeredProductsQuery);

  const catalogProductsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products')), [db]);
  const { data: catalogProducts, isLoading: isCatalogLoading } = useCollection(catalogProductsQuery);

  const customersQuery = useMemoFirebase(() => query(collection(db, 'customers'), orderBy('name', 'asc')), [db]);
  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [manualObservations, setManualObservations] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("none");
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("none");
  const [selectedProductId, setSelectedProductId] = useState<string>("none");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [productSearch, setProductSearch] = useState<string>("");
  const [lineFilter, setLineFilter] = useState<string>("none");
  const [isCustomMode, setIsCustomMode] = useState(true);
  const [quantity, setQuantity] = useState<number>(1);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [contractPercent, setContractPercent] = useState<number>(0);
  const [isBonus, setIsBonus] = useState(false);

  // Popula o estado quando o pedido é carregado
  useEffect(() => {
    if (order && !isOrderLoading) {
      setSelectedCustomerId(order.customerId || "none");
      setOrderItems(order.items || []);
      setManualObservations(order.notes?.split('\n\n--- RESUMO DE BONIFICAÇÃO ---')[0] || "");
      
      // Se tiver itens, tenta setar a fábrica e linha do primeiro item para facilitar a continuação
      if (order.items && order.items.length > 0) {
        const firstItem = order.items[0];
        const product = registeredProducts?.find(p => p.id === firstItem.productId);
        if (product) {
          setSelectedFactoryId(product.factoryId);
          setLineFilter(product.line);
        }
      }
    }
  }, [order, isOrderLoading, registeredProducts]);

  const availableLines = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts) return [];
    const lines = registeredProducts
      .filter(p => p.factoryId === selectedFactoryId)
      .map(p => p.line)
      .filter(Boolean);
    return Array.from(new Set(lines)).sort();
  }, [selectedFactoryId, registeredProducts]);

  const availableBrands = useMemo(() => {
    if (selectedFactoryId === "none" || lineFilter === "none" || !registeredProducts) return [];
    const brands = registeredProducts
      .filter(p => p.factoryId === selectedFactoryId && p.line === lineFilter)
      .map(p => p.brand)
      .filter(Boolean);
    return Array.from(new Set(brands)).sort();
  }, [selectedFactoryId, lineFilter, registeredProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts || lineFilter === "none") return [];
    
    let filtered = registeredProducts.filter(p => 
      p.factoryId === selectedFactoryId && p.catalogProductId && p.line === lineFilter
    );

    if (selectedBrand !== "all") {
      filtered = filtered.filter(p => p.brand === selectedBrand);
    }

    if (productSearch.trim()) {
      const term = productSearch.toLowerCase();
      filtered = filtered.filter(p => 
        p.code?.toLowerCase().includes(term) || 
        p.description?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [selectedFactoryId, registeredProducts, productSearch, lineFilter, selectedBrand]);

  const currentRegisteredProduct = useMemo(() => {
    return registeredProducts?.find(p => p.id === selectedProductId);
  }, [selectedProductId, registeredProducts]);

  const currentCatalogProduct = useMemo(() => {
    if (!currentRegisteredProduct?.catalogProductId || !catalogProducts) return null;
    return catalogProducts.find(p => p.id === currentRegisteredProduct.catalogProductId);
  }, [currentRegisteredProduct, catalogProducts]);

  const parseST = (stValue: string | undefined): number => {
    if (!stValue) return 0;
    const cleaned = stValue.replace('%', '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed / 100;
  };

  const calculateItemPrices = (registeredItem: any, catalogItem: any) => {
    if (!registeredItem || !catalogItem) return null;

    const basePrice = priceType === 'closed' 
      ? (catalogItem.closedLoadPrice || 0) 
      : (catalogItem.fractionalLoadPrice || 0);
    
    const priceAfterCatalog = Math.max(0, basePrice - (catalogItem.discountAmount || 0));
    
    const surchargeValue = registeredItem.customSurchargeValue !== undefined ? Number(registeredItem.customSurchargeValue) : (registeredItem.customSurchargeR$ || 0);
    const surchargeType = registeredItem.customSurchargeType || 'fixed';
    
    let baseWithSurcharge = priceAfterCatalog;
    if (surchargeType === 'percentage') {
      baseWithSurcharge += priceAfterCatalog * (surchargeValue / 100);
    } else {
      baseWithSurcharge += surchargeValue;
    }
    
    const finalUnitPriceBeforeST = baseWithSurcharge * (1 + contractPercent / 100);
    const stRate = parseST(registeredItem.st);
    const finalUnitPriceWithST = finalUnitPriceBeforeST * (1 + stRate);

    return {
      finalUnitPriceBeforeST: Number(finalUnitPriceBeforeST.toFixed(2)),
      stRate,
      finalUnitPriceWithST: Number(finalUnitPriceWithST.toFixed(2))
    };
  };

  const unitCalculations = useMemo(() => {
    return calculateItemPrices(currentRegisteredProduct, currentCatalogProduct);
  }, [currentCatalogProduct, currentRegisteredProduct, priceType, contractPercent]);

  const handleAddProduct = () => {
    if (!currentRegisteredProduct || !currentCatalogProduct || !unitCalculations) {
      toast({ title: "Erro", description: "Produto inválido.", variant: "destructive" });
      return;
    }

    if (orderItems.length > 0 && currentRegisteredProduct.line !== orderItems[0].line) {
      toast({ 
        title: "Mistura de Linhas Não Permitida", 
        description: `Este pedido já contém itens da linha "${orderItems[0].line}".`, 
        variant: "destructive" 
      });
      return;
    }

    const { finalUnitPriceWithST, finalUnitPriceBeforeST, stRate } = unitCalculations;
    
    const qtyPerBox = currentRegisteredProduct.quantityPerBox || 1;
    const total = isBonus ? 0 : (finalUnitPriceWithST * qtyPerBox * (quantity || 1));
    const weight = isBonus ? 0 : ((currentRegisteredProduct.boxWeightKg || 0) * (quantity || 1));

    const newItem: OrderItem = {
      productId: currentRegisteredProduct.id,
      catalogProductId: currentCatalogProduct.id,
      factoryName: factories?.find(f => f.id === selectedFactoryId)?.name || "Fábrica",
      code: currentRegisteredProduct.code,
      name: currentRegisteredProduct.description,
      ean: currentRegisteredProduct.ean || '',
      unit: currentRegisteredProduct.unit,
      quantity: quantity || 1,
      priceType,
      unitPriceNet: finalUnitPriceBeforeST,
      unitPriceFinal: finalUnitPriceWithST,
      appliedContract: contractPercent,
      stRate: stRate * 100,
      total,
      weight,
      line: currentRegisteredProduct.line || '',
      quantityPerBox: qtyPerBox,
      unitWeight: currentRegisteredProduct.boxWeightKg || 0,
      isBonus
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProductId("none");
    setQuantity(1);
    setIsBonus(false);
  };

  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 0) return;
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    item.quantity = newQuantity;
    item.total = item.isBonus ? 0 : (item.unitPriceFinal * item.quantityPerBox * newQuantity);
    item.weight = item.isBonus ? 0 : (item.unitWeight * newQuantity);
    setOrderItems(updatedItems);
  };

  const updateItemPrice = (index: number, newFinalPrice: number) => {
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    const stRateDecimal = (item.stRate || 0) / 100;
    const newNetPrice = Number((newFinalPrice / (1 + stRateDecimal)).toFixed(2));
    item.unitPriceFinal = Number(newFinalPrice.toFixed(2));
    item.unitPriceNet = newNetPrice;
    item.total = item.isBonus ? 0 : (item.unitPriceFinal * item.quantityPerBox * item.quantity);
    setOrderItems(updatedItems);
  };

  const updateItemNetPrice = (index: number, newNetPrice: number) => {
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    const stRateDecimal = (item.stRate || 0) / 100;
    const newFinalPrice = Number((newNetPrice * (1 + stRateDecimal)).toFixed(2));
    item.unitPriceNet = Number(newNetPrice.toFixed(2));
    item.unitPriceFinal = newFinalPrice;
    item.total = item.isBonus ? 0 : (newFinalPrice * item.quantityPerBox * item.quantity);
    setOrderItems(updatedItems);
  };

  const removeProduct = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const bonusSummaries = useMemo(() => {
    const grouped: Record<string, { saleQty: number, bonusQty: number, totalVal: number, name: string, qtyPerBox: number }> = {};
    orderItems.forEach(item => {
      const key = `${item.productId}-${item.priceType}`;
      if (!grouped[key]) grouped[key] = { saleQty: 0, bonusQty: 0, totalVal: 0, name: item.name, qtyPerBox: item.quantityPerBox };
      if (item.isBonus) grouped[key].bonusQty += item.quantity;
      else { grouped[key].saleQty += item.quantity; grouped[key].totalVal += item.total; }
    });
    return Object.values(grouped)
      .filter(g => g.saleQty > 0 && g.bonusQty > 0)
      .map(g => `• ${g.name}: Preço médio com bônus: R$ ${(g.totalVal / ((g.saleQty + g.bonusQty) * g.qtyPerBox)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }, [orderItems]);

  const handleProcessOrder = async (status: 'DRAFT' | 'CONFIRMED') => {
    if (!orderRef || orderItems.length === 0 || selectedCustomerId === "none") return;
    
    status === 'DRAFT' ? setIsSavingDraft(true) : setIsFinalizing(true);

    let finalNotes = manualObservations;
    if (bonusSummaries.length > 0) finalNotes += `\n\n--- RESUMO DE BONIFICAÇÃO ---\n${bonusSummaries.join('\n')}`;

    const orderData = {
      customerId: selectedCustomerId,
      customerName: customers?.find(c => c.id === selectedCustomerId)?.name || 'Cliente',
      items: orderItems,
      notes: finalNotes,
      totalAmount: orderItems.reduce((acc, item) => acc + item.total, 0),
      totalWeight: orderItems.reduce((acc, item) => acc + item.weight, 0),
      status,
      updatedAt: serverTimestamp()
    };

    try {
      updateDocumentNonBlocking(orderRef, orderData);
      toast({ title: status === 'DRAFT' ? "Rascunho atualizado" : "Pedido finalizado" });
      router.push('/orders/history');
    } catch (e) {
      status === 'DRAFT' ? setIsSavingDraft(false) : setIsFinalizing(false);
    }
  };

  const orderTotal = orderItems.reduce((acc, item) => acc + item.total, 0);
  const orderTotalWeight = orderItems.reduce((acc, item) => acc + item.weight, 0);

  if (isOrderLoading || isFactoriesLoading || isRegisteredLoading || isCatalogLoading || isCustomersLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/orders/history" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft size={28} />
          </Link>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2">
            <Edit size={24} /> Editar Pedido
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md border-none">
             <CardHeader className="bg-accent/5 py-4 px-5">
                <CardTitle className="text-base flex items-center gap-2"><User size={18} className="text-accent" /> Cliente</CardTitle>
             </CardHeader>
             <CardContent className="pt-4 px-5">
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escolha um cliente...</SelectItem>
                    {customers?.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
             </CardContent>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader className="bg-primary/5 py-4 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus size={18} className="text-primary" /> Adicionar Item
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-5 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase">Fábrica</Label>
                  <Select value={selectedFactoryId} onValueChange={(val) => { setSelectedFactoryId(val); setSelectedProductId("none"); setSelectedBrand("all"); setProductSearch(""); setLineFilter("none"); }}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Fábrica" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione...</SelectItem>
                      {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedFactoryId !== "none" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Linha</Label>
                    <Select value={lineFilter} onValueChange={(val) => { setLineFilter(val); setSelectedBrand("all"); setSelectedProductId("none"); }}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Linha" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Escolha a Linha...</SelectItem>
                        {availableLines.map(line => (<SelectItem key={line} value={line}>{line}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedFactoryId !== "none" && lineFilter !== "none" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase">Marca</Label>
                      <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {availableBrands.map(brand => (<SelectItem key={brand} value={brand}>{brand}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Produto</Label>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input placeholder="Filtrar..." className="pl-10 h-11" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setSelectedProductId("none"); }} />
                      </div>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Produto" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione...</SelectItem>
                          {filteredProducts.map(p => (<SelectItem key={p.id} value={p.id}>{p.code} - {p.description}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProductId !== "none" && (
                      <div className="space-y-4">
                        <RadioGroup value={priceType} onValueChange={(val: any) => setPriceType(val)} className="grid grid-cols-2 gap-2">
                          <Label htmlFor="price-closed" className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer ${priceType === 'closed' ? 'border-primary bg-primary/5' : 'border-muted'}`}><RadioGroupItem value="closed" id="price-closed" className="sr-only" /><span className="font-semibold text-xs">Fechada</span></Label>
                          <Label htmlFor="price-fractional" className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer ${priceType === 'fractional' ? 'border-primary bg-primary/5' : 'border-muted'}`}><RadioGroupItem value="fractional" id="price-fractional" className="sr-only" /><span className="font-semibold text-xs">Fracionado</span></Label>
                        </RadioGroup>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><Label className="text-xs">Qtd (Cxs)</Label><Input type="number" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} onFocus={(e) => e.target.select()} className="font-bold text-lg h-11"/></div>
                          <div className="space-y-1.5"><Label className="text-xs">Contrato (%)</Label><Input type="number" value={contractPercent} onChange={(e) => setContractPercent(Number(e.target.value))} onFocus={(e) => e.target.select()} className="h-11 font-bold text-primary"/></div>
                        </div>
                        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg">
                          <Switch id="bonus-mode" checked={isBonus} onCheckedChange={setIsBonus} />
                          <Label htmlFor="bonus-mode" className="text-xs font-bold flex items-center gap-1 cursor-pointer"><Gift size={14} className="text-accent" /> Bonificado</Label>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
            {unitCalculations && (
              <div className="px-5 py-4 bg-muted/50 border-y flex justify-between items-center">
                <span className="text-sm font-bold">Unitário Final:</span>
                <span className={`text-xl font-black ${isBonus ? 'text-muted-foreground line-through' : 'text-primary'}`}>R$ {unitCalculations.finalUnitPriceWithST.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <CardFooter className="pt-4 px-5">
              <Button className="w-full gap-2 h-14 text-lg font-bold shadow-lg" onClick={handleAddProduct} disabled={selectedProductId === "none"}><Plus size={20} /> Adicionar</Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-none flex flex-col min-h-[400px]">
            <CardHeader className="bg-primary text-white rounded-t-lg py-4 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><ShoppingCart size={20} /> Carrinho</CardTitle>
              <Badge variant="outline" className="text-white border-white/40 px-3 py-1 font-bold">{orderItems.length} Itens</Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4 opacity-30"><Calculator size={48} /><p className="font-medium">Vazio.</p></div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="overflow-x-auto flex-1">
                    <Table>
                      <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">Item</TableHead><TableHead className="text-center text-xs">Qtd</TableHead><TableHead className="text-right text-xs">Preços e Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {orderItems.map((item, idx) => (
                          <TableRow key={`${item.productId}-${idx}`} className={item.isBonus ? "bg-accent/5" : ""}>
                            <TableCell className="py-3">
                              <div className="font-bold text-xs uppercase">{item.name}</div>
                              <div className="text-[9px] text-muted-foreground font-medium uppercase">{item.priceType === 'closed' ? 'FECHADA' : 'FRAC'}</div>
                              {item.isBonus && <Badge variant="outline" className="text-[8px] h-4 bg-accent text-white border-none mt-1">BONIFICAÇÃO</Badge>}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateItemQuantity(idx, item.quantity - 1)} disabled={item.quantity <= 1}><Minus size={12} /></Button>
                                <input type="number" className="h-8 w-12 text-center border rounded font-bold text-xs" value={item.quantity || ""} onChange={(e) => updateItemQuantity(idx, Number(e.target.value))} onFocus={(e) => e.target.select()} />
                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateItemQuantity(idx, item.quantity + 1)}><Plus size={12} /></Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-3">
                              <div className="flex flex-col items-end gap-1.5">
                                <div className={`font-black text-xs ${item.isBonus ? 'text-accent' : 'text-primary'}`}>{item.isBonus ? 'BONUS' : `R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 justify-end">
                                    <span className="text-[8px] text-muted-foreground font-bold">NET:</span>
                                    <input type="number" step="0.01" className="h-7 w-20 text-right border rounded bg-slate-50 font-bold text-[10px] px-1" value={item.unitPriceNet || ""} onChange={(e) => !item.isBonus && updateItemNetPrice(idx, Number(e.target.value))} onFocus={(e) => e.target.select()} readOnly={item.isBonus} />
                                  </div>
                                  <div className="flex items-center gap-1 justify-end">
                                    <span className="text-[8px] text-primary font-bold">FINAL:</span>
                                    <input type="number" step="0.01" className="h-7 w-20 text-right border rounded bg-slate-50 font-bold text-[10px] px-1 border-primary/40" value={item.unitPriceFinal || ""} onChange={(e) => !item.isBonus && updateItemPrice(idx, Number(e.target.value))} onFocus={(e) => e.target.select()} readOnly={item.isBonus} />
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-2"><Button variant="ghost" size="icon" onClick={() => removeProduct(idx)} className="text-destructive h-8 w-8"><Trash2 size={16} /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-5 border-t bg-muted/10 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Observações</Label>
                      <Textarea placeholder="Detalhes de entrega..." className="min-h-[80px] bg-white text-xs" value={manualObservations} onChange={(e) => setManualObservations(e.target.value)} />
                    </div>
                    {bonusSummaries.length > 0 && (
                      <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
                        <p className="text-[10px] font-black text-accent uppercase mb-2">Resumo de Bonificação</p>
                        <div className="space-y-1.5">{bonusSummaries.map((s, i) => <p key={i} className="text-[11px] text-accent font-medium leading-tight">{s}</p>)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="bg-primary/5 p-6 flex flex-col border-t gap-5">
                <div className="w-full flex justify-between items-center">
                  <div className="space-y-0.5"><p className="text-[10px] text-muted-foreground uppercase font-black">Total</p><p className="text-3xl font-black text-primary">R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border shadow-sm"><Weight size={18} className="text-primary" /><div><p className="text-[9px] text-muted-foreground uppercase font-bold">Peso</p><p className="text-base font-black">{orderTotalWeight.toFixed(2)} Kg</p></div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  <Button variant="outline" className="h-14 border-primary text-primary font-bold" onClick={() => router.push('/orders/history')}>Cancelar</Button>
                  <Button variant="secondary" className="h-14 font-bold gap-2 text-lg" onClick={() => handleProcessOrder('DRAFT')} disabled={isFinalizing || isSavingDraft}>
                    {isSavingDraft ? <Loader2 className="animate-spin" /> : <Save size={20} />} Atualizar
                  </Button>
                  <Button className="h-14 bg-accent hover:bg-accent/90 text-white shadow-lg gap-2 text-lg font-bold" onClick={() => handleProcessOrder('CONFIRMED')} disabled={isFinalizing || isSavingDraft}>
                    {isFinalizing ? <Loader2 className="animate-spin" /> : <ReceiptText size={20} />} Finalizar
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
