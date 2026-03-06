"use client"

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useAuth } from '@/firebase';
import { collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Trash2, Calculator, ReceiptText, Zap, 
  Loader2, Weight, Tag, User, AlertTriangle, Search, Snowflake, Sun, FileDown, LogOut, MessageSquare, Settings2, Minus, MessageCircle, ClipboardCopy, Check, ArrowLeft, Save, Gift
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type OrderItem = {
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

export default function NewOrderPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState<string>("");
  
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
  const [categoryFilter, setCategoryFilter] = useState<string>("none");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [useCatalogDiscount, setUseCatalogDiscount] = useState<boolean>(true);
  const [contractPercent, setContractPercent] = useState<number>(0);
  const [isBonus, setIsBonus] = useState(false);
  
  const [showAraRulesDialog, setShowAraRulesDialog] = useState(false);
  const [showBvgRulesDialog, setShowBvgRulesDialog] = useState(false);
  const [showMrvRulesDialog, setShowMrvRulesDialog] = useState(false);
  const [showSjoRulesDialog, setShowSjoRulesDialog] = useState(false);

  // States para exportação PDF
  const [showExportConfigDialog, setShowExportConfigDialog] = useState(false);
  const [exportFactoryId, setExportFactoryId] = useState<string>("none");
  const [exportLineFilter, setExportLineFilter] = useState<string>("none");
  const [exportContractPercent, setExportContractPercent] = useState<number>(0);
  const [exportPriceType, setExportPriceType] = useState<'closed' | 'fractional'>('closed');
  const [exportBrand, setExportBrand] = useState<string>("all");

  // States para o compartilhamento de WhatsApp
  const [showZapDialog, setShowZapDialog] = useState(false);
  const [zapFactoryId, setZapFactoryId] = useState<string>("none");
  const [zapLineFilter, setZapLineFilter] = useState<string>("none");
  const [zapBrandFilter, setZapBrandFilter] = useState<string>("all");
  const [zapSelectedIds, setZapSelectedIds] = useState<string[]>([]);
  const [zapPriceTypes, setZapPriceTypes] = useState<Record<string, 'closed' | 'fractional'>>({});
  const [zapContractPercent, setZapContractPercent] = useState<number>(0);
  const [zapSearchTerm, setZapSearchTerm] = useState("");
  const [zapGeneratedText, setZapGeneratedText] = useState("");

  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    setDeliveryEstimate(date.toLocaleDateString('pt-BR'));
  }, []);

  // Calcula o resumo de bonificação em tempo real
  const bonusSummaries = useMemo(() => {
    if (orderItems.length === 0) return [];

    const groupedItems: Record<string, { saleQty: number, bonusQty: number, totalVal: number, name: string, qtyPerBox: number }> = {};

    orderItems.forEach(item => {
      const key = `${item.productId}-${item.priceType}`;
      if (!groupedItems[key]) {
        groupedItems[key] = { 
          saleQty: 0, 
          bonusQty: 0, 
          totalVal: 0, 
          name: item.name,
          qtyPerBox: item.quantityPerBox 
        };
      }
      
      if (item.isBonus) {
        groupedItems[key].bonusQty += item.quantity;
      } else {
        groupedItems[key].saleQty += item.quantity;
        groupedItems[key].totalVal += item.total;
      }
    });

    const summaries: string[] = [];
    Object.values(groupedItems).forEach(group => {
      if (group.saleQty > 0 && group.bonusQty > 0) {
        const totalQtyBoxes = group.saleQty + group.bonusQty;
        // Preço médio unitário = Investimento total / (Total de Caixas * Unidades por Caixa)
        const avgUnitPrice = group.totalVal / (totalQtyBoxes * group.qtyPerBox);
        summaries.push(`• ${group.name}: Preço unitário médio com bonificação: R$ ${avgUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Venda: ${group.saleQty} cx + Bônus: ${group.bonusQty} cx)`);
      }
    });

    return summaries;
  }, [orderItems]);

  const selectedFactory = useMemo(() => {
    return factories?.find(f => f.id === selectedFactoryId);
  }, [selectedFactoryId, factories]);

  const handleCategoryChange = (val: string) => {
    setCategoryFilter(val);
    setSelectedProductId("none");
    setSelectedBrand("all");
    setProductSearch("");

    if (val === "none") {
      setSelectedFactoryId("none");
      setLineFilter("none");
      return;
    }

    let targetFactory = "";
    let targetLine = "";

    if (val === "leite") {
      targetFactory = "ARA";
      targetLine = "SECA UHT";
    } else if (val === "mix") {
      targetFactory = "MRV";
      targetLine = "SECA";
      setPriceType('fractional');
    } else if (val === "refrigerados") {
      targetFactory = "BVG";
      targetLine = "REFRIGERADA";
    }

    const foundFactory = factories?.find(f => f.name.toUpperCase().includes(targetFactory));
    if (foundFactory) {
      setSelectedFactoryId(foundFactory.id);
      setLineFilter(targetLine);
    }
  };

  useEffect(() => {
    const factoryName = selectedFactory?.name?.toUpperCase() || '';
    const selectedLine = lineFilter?.toUpperCase() || '';

    if (factoryName.includes('ARA') && selectedLine.includes('SECA UHT')) {
      setShowAraRulesDialog(true);
    } else if (factoryName.includes('BVG') && selectedLine.includes('REFRIGERADA')) {
      setShowBvgRulesDialog(true);
    } else if (factoryName.includes('MRV') && selectedLine.includes('SECA')) {
      setShowMrvRulesDialog(true);
      setPriceType('fractional');
    } else if (factoryName.includes('SJO') && selectedLine.includes('REFRIGERADA')) {
      setShowSjoRulesDialog(true);
    }
  }, [selectedFactoryId, lineFilter, selectedFactory]);

  const getAvailableLines = (factoryId: string) => {
    if (factoryId === "none" || !registeredProducts) return [];
    const lines = registeredProducts
      .filter(p => p.factoryId === factoryId)
      .map(p => p.line)
      .filter(Boolean);
    return Array.from(new Set(lines)).sort();
  };

  const getAvailableBrands = (factoryId: string, line: string) => {
    if (factoryId === "none" || line === "none" || !registeredProducts) return [];
    const brands = registeredProducts
      .filter(p => p.factoryId === factoryId && p.line === line)
      .map(p => p.brand)
      .filter(Boolean);
    return Array.from(new Set(brands)).sort();
  };

  const availableLines = useMemo(() => getAvailableLines(selectedFactoryId), [selectedFactoryId, registeredProducts]);
  const availableBrands = useMemo(() => getAvailableBrands(selectedFactoryId, lineFilter), [selectedFactoryId, lineFilter, registeredProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts || lineFilter === "none") return [];
    
    let filtered = registeredProducts.filter(p => 
      p.factoryId === selectedFactoryId && p.catalogProductId && p.line === lineFilter
    );

    if (selectedBrand !== "all" && selectedBrand !== "none") {
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

  const selectedCustomer = useMemo(() => {
    return customers?.find(c => c.id === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  const parseST = (stValue: string | undefined): number => {
    if (!stValue) return 0;
    const cleaned = stValue.replace('%', '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed / 100;
  };

  const calculateItemPrices = (registeredItem: any, catalogItem: any, overridePercent?: number, overridePriceType?: 'closed' | 'fractional') => {
    if (!registeredItem || !catalogItem) return null;

    const activePriceType = overridePriceType || priceType;
    const basePrice = activePriceType === 'closed' 
      ? (catalogItem.closedLoadPrice || 0) 
      : (catalogItem.fractionalLoadPrice || 0);
    
    const catalogDiscount = useCatalogDiscount ? (catalogItem.discountAmount || 0) : 0;
    const priceAfterCatalog = Math.max(0, basePrice - catalogDiscount);
    
    const activePercent = overridePercent !== undefined ? overridePercent : (contractPercent || 0);
    
    // Suporte para aditivo fixo ou percentual
    const surchargeValue = registeredItem.customSurchargeValue !== undefined ? Number(registeredItem.customSurchargeValue) : (registeredItem.customSurchargeR$ || 0);
    const surchargeType = registeredItem.customSurchargeType || 'fixed';
    
    let baseWithSurcharge = priceAfterCatalog;
    if (surchargeType === 'percentage') {
      baseWithSurcharge += priceAfterCatalog * (surchargeValue / 100);
    } else {
      baseWithSurcharge += surchargeValue;
    }
    
    const finalUnitPriceBeforeST = baseWithSurcharge * (1 + activePercent / 100);
    
    const stRate = parseST(registeredItem.st);
    const stAmount = finalUnitPriceBeforeST * stRate;
    const finalUnitPriceWithST = finalUnitPriceBeforeST + stAmount;

    return {
      basePrice,
      catalogDiscount,
      priceAfterCatalog,
      finalUnitPriceBeforeST,
      stRate,
      stAmount,
      finalUnitPriceWithST
    };
  };

  const unitCalculations = useMemo(() => {
    return calculateItemPrices(currentRegisteredProduct, currentCatalogProduct);
  }, [currentCatalogProduct, currentRegisteredProduct, priceType, useCatalogDiscount, contractPercent]);

  const handlePriceTypeChange = (newType: 'closed' | 'fractional') => {
    setPriceType(newType);
    
    if (orderItems.length === 0) return;

    const updatedItems = orderItems.map(item => {
      if (item.isBonus) return item;

      const catalogItem = catalogProducts?.find(cp => cp.id === item.catalogProductId);
      const registeredItem = registeredProducts?.find(rp => rp.id === item.productId);
      
      if (!catalogItem || !registeredItem) return item;

      const basePrice = newType === 'closed' 
        ? (catalogItem.closedLoadPrice || 0) 
        : (catalogItem.fractionalLoadPrice || 0);
      
      const catalogDiscount = useCatalogDiscount ? (catalogItem.discountAmount || 0) : 0;
      const priceAfterCatalog = Math.max(0, basePrice - catalogDiscount);
      
      const surchargeValue = registeredItem.customSurchargeValue !== undefined ? Number(registeredItem.customSurchargeValue) : (registeredItem.customSurchargeR$ || 0);
      const surchargeType = registeredItem.customSurchargeType || 'fixed';
      
      let baseWithSurcharge = priceAfterCatalog;
      if (surchargeType === 'percentage') {
        baseWithSurcharge += priceAfterCatalog * (surchargeValue / 100);
      } else {
        baseWithSurcharge += surchargeValue;
      }
      
      const finalUnitPriceBeforeST = baseWithSurcharge * (1 + (item.appliedContract || 0) / 100);
      
      const stRate = parseST(registeredItem.st);
      const stAmount = finalUnitPriceBeforeST * stRate;
      const finalUnitPriceWithST = finalUnitPriceBeforeST + stAmount;
      
      const qtyPerBox = registeredItem.quantityPerBox || 1;
      const total = finalUnitPriceWithST * qtyPerBox * item.quantity;

      return {
        ...item,
        priceType: newType,
        unitPriceNet: finalUnitPriceBeforeST,
        unitPriceFinal: finalUnitPriceWithST,
        total: total
      };
    });

    setOrderItems(updatedItems);
  };

  const handleAddProduct = () => {
    if (!currentRegisteredProduct || !currentCatalogProduct || !unitCalculations) {
      toast({ title: "Erro", description: "Produto inválido ou sem preço encontrado no catálogo.", variant: "destructive" });
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
      factoryName: selectedFactory?.name || "Fábrica",
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
    toast({
      title: isBonus ? "Bonificação Adicionada" : "Adicionado",
      description: `${currentRegisteredProduct.description} no carrinho.`,
    });

    setSelectedProductId("none");
    setProductSearch("");
    setQuantity(1);
    setContractPercent(0);
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
    if (newFinalPrice < 0) return;
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    const stRateDecimal = (item.stRate || 0) / 100;
    const newNetPrice = newFinalPrice / (1 + stRateDecimal);
    item.unitPriceFinal = newFinalPrice;
    item.unitPriceNet = newNetPrice;
    item.total = item.isBonus ? 0 : (newFinalPrice * item.quantityPerBox * item.quantity);
    setOrderItems(updatedItems);
  };

  const handleSaveDraft = async () => {
    if (orderItems.length === 0) return;
    if (selectedCustomerId === "none") {
      toast({ title: "Cliente obrigatório", description: "Selecione um cliente para salvar o rascunho.", variant: "destructive" });
      return;
    }

    setIsSavingDraft(true);
    
    let finalObservations = manualObservations;
    if (bonusSummaries.length > 0) {
      finalObservations += `\n\n--- RESUMO DE BONIFICAÇÃO ---\n${bonusSummaries.join('\n')}`;
    }

    const orderData = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Cliente Desconhecido',
      items: orderItems,
      notes: finalObservations,
      totalAmount: orderTotal,
      totalWeight: orderTotalWeight,
      status: 'DRAFT',
      createdAt: serverTimestamp(),
      userId: auth.currentUser?.uid || 'anonymous'
    };

    try {
      await addDocumentNonBlocking(collection(db, 'orders'), orderData);
      toast({ title: "Rascunho Salvo", description: "O pedido foi salvo para edição posterior." });
      router.push('/orders/history');
    } catch (error) {
      toast({ title: "Erro", description: "Problema ao salvar rascunho.", variant: "destructive" });
      setIsSavingDraft(false);
    }
  };

  const handleFinalizeOrder = async () => {
    if (orderItems.length === 0) return;
    if (selectedCustomerId === "none") {
      toast({ title: "Cliente obrigatório", description: "Selecione um cliente.", variant: "destructive" });
      return;
    }

    const totalQty = orderItems.reduce((acc, item) => acc + item.quantity, 0);
    const totalWeight = orderItems.reduce((acc, item) => acc + item.weight, 0);
    const totalAmount = orderItems.reduce((acc, item) => acc + item.total, 0);
    const factoryName = selectedFactory?.name?.toUpperCase() || '';
    const selectedLine = orderItems[0]?.line?.toUpperCase() || '';

    if (factoryName.includes('ARA') && selectedLine.includes('SECA UHT')) {
      if (totalQty < 30) {
        toast({ title: "Pedido Inválido", description: `Mínimo 30 caixas (Atual: ${totalQty}).`, variant: "destructive" });
        return;
      }
      if (totalQty >= 30 && totalQty <= 130 && orderItems.some(item => !item.isBonus && item.priceType !== 'fractional')) {
        toast({ title: "Ajuste de Preço", description: "Use 'Fracionado' para este volume.", variant: "destructive" });
        return;
      }
      if (totalQty > 130 && orderItems.some(item => !item.isBonus && item.priceType !== 'closed')) {
        toast({ title: "Ajuste de Preço", description: "Use 'Carga Fechada' para este volume.", variant: "destructive" });
        return;
      }
    }

    if (factoryName.includes('BVG') && selectedLine.includes('REFRIGERADA') && totalWeight < 70) {
      toast({ title: "Peso Mínimo", description: `Mínimo 70 Kg (Atual: ${totalWeight.toFixed(2)}).`, variant: "destructive" });
      return;
    }

    if (factoryName.includes('SJO') && selectedLine.includes('REFRIGERADA') && totalWeight < 1500) {
      toast({ title: "Peso Mínimo", description: `Mínimo 1.500 Kg (Atual: ${totalWeight.toFixed(2)}).`, variant: "destructive" });
      return;
    }

    if (factoryName.includes('MRV') && selectedLine.includes('SECA') && totalAmount < 1500) {
      toast({ title: "Pedido Mínimo", description: `Mínimo R$ 1.500,00.`, variant: "destructive" });
      return;
    }

    setIsFinalizing(true);

    let finalObservations = manualObservations;
    if (bonusSummaries.length > 0) {
      finalObservations += `\n\n--- RESUMO DE BONIFICAÇÃO ---\n${bonusSummaries.join('\n')}`;
    }

    const orderData = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Cliente Desconhecido',
      items: orderItems,
      notes: finalObservations,
      totalAmount: orderTotal,
      totalWeight: orderTotalWeight,
      status: 'CONFIRMED',
      createdAt: serverTimestamp(),
      userId: auth.currentUser?.uid || 'anonymous'
    };

    try {
      await addDocumentNonBlocking(collection(db, 'orders'), orderData);
      toast({ title: "Finalizado!", description: "Pedido gravado com sucesso." });
      router.push('/orders/history');
    } catch (error) {
      toast({ title: "Erro", description: "Problema ao salvar pedido.", variant: "destructive" });
      setIsFinalizing(false);
    }
  };

  const removeProduct = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    if (updatedItems.length === 0) {
      setCategoryFilter("none");
      setSelectedFactoryId("none");
      setLineFilter("none");
      setManualObservations("");
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  const orderTotal = useMemo(() => orderItems.reduce((acc, item) => acc + item.total, 0), [orderItems]);
  const orderTotalWeight = useMemo(() => orderItems.reduce((acc, item) => acc + item.weight, 0), [orderItems]);

  const isLoading = isFactoriesLoading || isRegisteredLoading || isCatalogLoading || isCustomersLoading;

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-7xl">
      <AlertDialog open={showAraRulesDialog} onOpenChange={setShowAraRulesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle className="text-orange-500" /> Regras ARA
            </AlertDialogTitle>
            <div className="space-y-4 py-2 text-foreground text-sm">
              <ul className="space-y-3 list-disc pl-4">
                <li>Mínimo: 30 caixas.</li>
                <li>30 a 130 cxs: Fracionado.</li>
                <li>Acima 130 cxs: Carga Fechada.</li>
              </ul>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction className="w-full">OK</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary">Criar Pedido</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowZapDialog(true)} className="gap-2 border-green-500 text-green-600 hover:bg-green-50 h-10 px-4">
            <MessageCircle size={16} /> Compartilhar Zap
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowExportConfigDialog(true)} disabled={isExporting} className="gap-2 border-accent text-accent hover:bg-accent/5 h-10 px-4">
            {isExporting ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            Tabela PDF
          </Button>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold flex items-center gap-2 h-10">
            <Zap size={18} /> InteliPreço
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive h-10 px-3">
            <LogOut size={18} />
          </Button>
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
                {selectedCustomer && (
                  <div className="mt-2 p-2 bg-muted rounded text-[10px] space-y-1">
                    <p><strong>CNPJ:</strong> {selectedCustomer.cnpj} | <strong>Prazo:</strong> {selectedCustomer.paymentTerm}</p>
                  </div>
                )}
             </CardContent>
          </Card>

          <Card className="shadow-md border-none">
            <CardHeader className="bg-primary/5 py-4 px-5">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Plus size={18} className="text-primary" /> Item</div>
                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold text-primary flex items-center gap-1" onClick={() => { setIsCustomMode(!isCustomMode); setCategoryFilter("none"); setSelectedFactoryId("none"); setLineFilter("none"); }} disabled={orderItems.length > 0}>
                  <Settings2 size={12} /> {isCustomMode ? "Modo Simples" : "Personalizar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-5 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2"><Loader2 className="animate-spin text-primary" /><span className="text-xs text-muted-foreground">Sincronizando...</span></div>
              ) : (
                <>
                  {!isCustomMode ? (
                    <div className="space-y-1.5 animate-in slide-in-from-left-2 duration-300">
                      <Label className="text-xs font-bold uppercase">Tipo de Pedido</Label>
                      <Select value={categoryFilter} onValueChange={handleCategoryChange} disabled={orderItems.length > 0}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione...</SelectItem>
                          <SelectItem value="leite">Leite (ARA - SECA UHT)</SelectItem>
                          <SelectItem value="mix">Mix (MRV - SECA)</SelectItem>
                          <SelectItem value="refrigerados">Refrigerados (BVG - REFRIGERADA)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase">Fábrica</Label>
                        <Select value={selectedFactoryId} onValueChange={(val) => { setSelectedFactoryId(val); setSelectedProductId("none"); setSelectedBrand("all"); setProductSearch(""); setLineFilter("none"); }} disabled={orderItems.length > 0}>
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
                          <Select value={lineFilter} onValueChange={(val) => { setLineFilter(val); setSelectedBrand("all"); setSelectedProductId("none"); }} disabled={orderItems.length > 0}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Linha" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Escolha a Linha...</SelectItem>
                              {availableLines.map(line => (<SelectItem key={line} value={line}>{line}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedFactoryId !== "none" && lineFilter !== "none" && (
                    <div className="space-y-4 animate-in fade-in duration-300">
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
                    </div>
                  )}

                  {selectedProductId !== "none" && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Preço</Label>
                        <RadioGroup value={priceType} onValueChange={(val: any) => handlePriceTypeChange(val)} className="grid grid-cols-2 gap-2">
                          <Label htmlFor="price-closed" className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${priceType === 'closed' ? 'border-primary bg-primary/5 text-primary' : 'border-muted'}`}><RadioGroupItem value="closed" id="price-closed" className="sr-only" /><span className="font-semibold text-xs">Fechada</span></Label>
                          <Label htmlFor="price-fractional" className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${priceType === 'fractional' ? 'border-primary bg-primary/5 text-primary' : 'border-muted'}`}><RadioGroupItem value="fractional" id="price-fractional" className="sr-only" /><span className="font-semibold text-xs">Fracionado</span></Label>
                        </RadioGroup>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label className="text-xs">Qtd (Cxs)</Label><Input type="number" value={quantity === 0 ? "" : quantity} onChange={(e) => setQuantity(e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="font-bold text-lg h-11"/></div>
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
            </CardContent>
            {unitCalculations && (
              <div className="px-5 py-4 bg-muted/50 border-y space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Unitário Final:</span>
                  <span className={`text-xl font-black ${isBonus ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                    R$ {formatCurrency(unitCalculations.finalUnitPriceWithST)}
                  </span>
                </div>
                {isBonus && (
                  <div className="text-right"><Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">VALOR ZERADO</Badge></div>
                )}
              </div>
            )}
            <CardFooter className="pt-4 px-5">
              <Button className="w-full gap-2 h-14 text-lg font-bold shadow-lg" onClick={handleAddProduct} disabled={selectedProductId === "none" || isLoading}><Plus size={20} /> Adicionar</Button>
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
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-muted-foreground font-medium uppercase">{item.priceType === 'closed' ? 'FECHADA' : 'FRAC'}</span>
                                {item.isBonus && <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 bg-accent text-white border-none">BONIFICAÇÃO</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateItemQuantity(idx, item.quantity - 1)} disabled={item.quantity <= 1}><Minus size={12} /></Button>
                                <input type="number" className="h-8 w-12 text-center border rounded font-bold text-xs" value={item.quantity === 0 ? "" : item.quantity} onChange={(e) => updateItemQuantity(idx, e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} />
                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateItemQuantity(idx, item.quantity + 1)}><Plus size={12} /></Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-3">
                              <div className="flex flex-col items-end gap-1">
                                <div className={`font-black text-xs ${item.isBonus ? 'text-accent' : 'text-primary'}`}>
                                  {item.isBonus ? 'BONUS' : `R$ ${formatCurrency(item.total)}`}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-muted-foreground font-medium">Unit R$:</span>
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    className={`h-7 w-20 text-right border rounded bg-slate-50 font-bold text-[11px] px-1 outline-none ${item.isBonus ? 'text-muted-foreground line-through opacity-50' : 'focus:border-primary focus:ring-1 focus:ring-primary'}`}
                                    value={item.unitPriceFinal === 0 ? "" : item.unitPriceFinal.toFixed(2)} 
                                    onChange={(e) => !item.isBonus && updateItemPrice(idx, e.target.value === "" ? 0 : Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    readOnly={item.isBonus}
                                  />
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
                      <Label className="text-xs font-bold uppercase flex items-center gap-2"><MessageSquare size={14} className="text-primary" /> Observações</Label>
                      <Textarea placeholder="Detalhes de entrega..." className="min-h-[80px] bg-white text-xs" value={manualObservations} onChange={(e) => setManualObservations(e.target.value)} />
                    </div>
                    
                    {bonusSummaries.length > 0 && (
                      <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-500">
                        <p className="text-[10px] font-black text-accent uppercase flex items-center gap-1 mb-2">
                          <Gift size={12} /> Resumo de Bonificação (Será anexo ao pedido)
                        </p>
                        <div className="space-y-1.5">
                          {bonusSummaries.map((summary, i) => (
                            <p key={i} className="text-[11px] text-accent font-medium leading-tight">{summary}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="bg-primary/5 p-6 flex flex-col border-t gap-5">
                <div className="w-full flex justify-between items-center">
                  <div className="space-y-0.5"><p className="text-[10px] text-muted-foreground uppercase font-black">Total</p><p className="text-3xl font-black text-primary">R$ {formatCurrency(orderTotal)}</p></div>
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border shadow-sm"><Weight size={18} className="text-primary" /><div><p className="text-[9px] text-muted-foreground uppercase font-bold">Peso</p><p className="text-base font-black">{orderTotalWeight.toFixed(2)} Kg</p></div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  <Button variant="outline" className="h-14 border-primary text-primary font-bold" onClick={() => { setOrderItems([]); setCategoryFilter("none"); setSelectedFactoryId("none"); setLineFilter("none"); setManualObservations(""); }} disabled={isFinalizing || isSavingDraft}>Limpar</Button>
                  <Button variant="secondary" className="h-14 font-bold gap-2 text-lg" onClick={handleSaveDraft} disabled={isFinalizing || isSavingDraft || selectedCustomerId === "none"}>
                    {isSavingDraft ? <Loader2 className="animate-spin" /> : <Save size={20} />} Rascunho
                  </Button>
                  <Button className="h-14 bg-accent hover:bg-accent/90 text-white shadow-lg gap-2 text-lg font-bold" onClick={handleFinalizeOrder} disabled={isFinalizing || isSavingDraft || selectedCustomerId === "none"}>
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
