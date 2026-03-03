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
  Loader2, Weight, Tag, User, AlertTriangle, Search, Snowflake, Sun, FileDown, LogOut, MessageSquare, Settings2, Minus, MessageCircle, ClipboardCopy, Check, ArrowLeft
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
  const [observations, setObservations] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);

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
  
  const [showAraRulesDialog, setShowAraRulesDialog] = useState(false);
  const [showBvgRulesDialog, setShowBvgRulesDialog] = useState(false);
  const [showMrvRulesDialog, setShowMrvRulesDialog] = useState(false);
  const [showSjoRulesDialog, setShowSjoRulesDialog] = useState(false);

  const [showExportContractDialog, setShowExportContractDialog] = useState(false);
  const [exportContractPercent, setExportContractPercent] = useState<number>(0);

  // States para o compartilhamento de WhatsApp
  const [showZapDialog, setShowZapDialog] = useState(false);
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

  const zapFilteredProducts = useMemo(() => {
    if (!filteredProducts) return [];
    if (!zapSearchTerm.trim()) return filteredProducts;
    const term = zapSearchTerm.toLowerCase();
    return filteredProducts.filter(p => 
      p.code?.toLowerCase().includes(term) || 
      p.description?.toLowerCase().includes(term)
    );
  }, [filteredProducts, zapSearchTerm]);

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
    const finalUnitPriceBeforeST = priceAfterCatalog * (1 + activePercent / 100);
    
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
      const catalogItem = catalogProducts?.find(cp => cp.id === item.catalogProductId);
      const registeredItem = registeredProducts?.find(rp => rp.id === item.productId);
      
      if (!catalogItem || !registeredItem) return item;

      const basePrice = newType === 'closed' 
        ? (catalogItem.closedLoadPrice || 0) 
        : (catalogItem.fractionalLoadPrice || 0);
      
      const catalogDiscount = useCatalogDiscount ? (catalogItem.discountAmount || 0) : 0;
      const priceAfterCatalog = Math.max(0, basePrice - catalogDiscount);
      
      const finalUnitPriceBeforeST = priceAfterCatalog * (1 + (item.appliedContract || 0) / 100);
      
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
    const total = finalUnitPriceWithST * qtyPerBox * (quantity || 1);
    const weight = (currentRegisteredProduct.boxWeightKg || 0) * (quantity || 1);

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
      unitWeight: currentRegisteredProduct.boxWeightKg || 0
    };

    setOrderItems([...orderItems, newItem]);
    toast({
      title: "Adicionado",
      description: `${currentRegisteredProduct.description} no carrinho.`,
    });

    setSelectedProductId("none");
    setProductSearch("");
    setQuantity(1);
    setContractPercent(0);
  };

  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 0) return;
    
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    
    item.quantity = newQuantity;
    item.total = item.unitPriceFinal * item.quantityPerBox * newQuantity;
    item.weight = item.unitWeight * newQuantity;
    
    setOrderItems(updatedItems);
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
      if (totalQty >= 30 && totalQty <= 130 && orderItems.some(item => item.priceType !== 'fractional')) {
        toast({ title: "Ajuste de Preço", description: "Use 'Fracionado' para este volume.", variant: "destructive" });
        return;
      }
      if (totalQty > 130 && orderItems.some(item => item.priceType !== 'closed')) {
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
    const orderData = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Cliente Desconhecido',
      items: orderItems,
      notes: observations,
      totalAmount: orderTotal,
      totalWeight: orderTotalWeight,
      createdAt: serverTimestamp(),
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
      setObservations("");
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

  const handleExportTablePDF = async () => {
    if (!pdfRef.current || filteredProducts.length === 0) return;
    setIsExporting(true);
    setShowExportContractDialog(false);
    toast({ title: "Exportando PDF", description: "Processando múltiplas páginas se necessário..." });
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(pdfRef.current, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        windowWidth: 800
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 14.5; // 1.45 cm
      const usableHeight = pdfHeight - (2 * margin);
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let pageNum = 0;

      while (heightLeft > 0) {
        if (pageNum > 0) pdf.addPage();
        
        const yOffset = margin - (pageNum * usableHeight);
        pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
        
        // Máscara de proteção para cabeçalho e rodapé (retângulos brancos)
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, margin, 'F');
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F');
        
        // Conteúdo do Cabeçalho Repetido
        pdf.setFontSize(10);
        pdf.setTextColor(40, 40, 40);
        pdf.text(`Fábrica: ${selectedFactory?.name || ''}`, margin, margin - 5);
        pdf.text(`Linha: ${lineFilter}`, pdfWidth / 2, margin - 5, { align: 'center' });
        pdf.text(`${new Date().toLocaleDateString('pt-BR')}`, pdfWidth - margin, margin - 5, { align: 'right' });
        
        // Conteúdo do Rodapé Repetido
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        if (exportContractPercent > 0) {
          pdf.text(`Contrato: ${exportContractPercent}%`, margin, pdfHeight - margin + 5);
        }
        pdf.text(`Página ${pageNum + 1}`, pdfWidth / 2, pdfHeight - margin + 5, { align: 'center' });
        pdf.text("InteliPreço - Sistema Inteligente", pdfWidth - margin, pdfHeight - margin + 5, { align: 'right' });

        heightLeft -= usableHeight;
        pageNum++;
      }

      pdf.save(`tabela_${selectedFactory?.name}_${lineFilter}.pdf`);
      toast({ title: "Sucesso", description: "Tabela exportada com todas as páginas!" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha na exportação do PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Funções para WhatsApp
  const handleToggleZapItem = (productId: string) => {
    setZapSelectedIds(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
    if (!zapPriceTypes[productId]) {
      setZapPriceTypes(prev => ({ ...prev, [productId]: 'closed' }));
    }
  };

  const handleSetZapPriceType = (productId: string, type: 'closed' | 'fractional') => {
    setZapPriceTypes(prev => ({ ...prev, [productId]: type }));
  };

  const handleGenerateZapMessage = () => {
    if (zapSelectedIds.length === 0) {
      toast({ title: "Seleção vazia", description: "Selecione pelo menos um item.", variant: "destructive" });
      return;
    }

    let message = `*Tabela de Preços - ${selectedFactory?.name}*\n`;
    message += `*Linha:* ${lineFilter}\n`;
    message += `*Data:* ${new Date().toLocaleDateString('pt-BR')}\n\n`;

    zapSelectedIds.forEach(id => {
      const p = registeredProducts?.find(item => item.id === id);
      const catalog = catalogProducts?.find(cp => cp.id === p?.catalogProductId);
      if (!p || !catalog) return;

      const type = zapPriceTypes[id] || 'closed';
      const prices = calculateItemPrices(p, catalog, zapContractPercent, type);
      if (!prices) return;

      message += `• *${p.description}*\n`;
      message += `  Preço: R$ ${formatCurrency(prices!.finalUnitPriceWithST)}\n\n`;
    });

    message += `_Gerado por InteliPreço_`;
    setZapGeneratedText(message);
  };

  const handleCopyZapText = () => {
    navigator.clipboard.writeText(zapGeneratedText);
    toast({ title: "Copiado!", description: "O texto está na sua área de transferência." });
  };

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

      <AlertDialog open={showBvgRulesDialog} onOpenChange={setShowBvgRulesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><AlertTriangle className="text-orange-500" /> Regras BVG</AlertDialogTitle>
            <div className="py-2 text-sm">Mínimo: 70 KG.</div>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction className="w-full">OK</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSjoRulesDialog} onOpenChange={setShowSjoRulesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><AlertTriangle className="text-orange-500" /> Regras SJO</AlertDialogTitle>
            <div className="py-2 text-sm">Mínimo: 1.500 KG.</div>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction className="w-full">OK</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMrvRulesDialog} onOpenChange={setShowMrvRulesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><AlertTriangle className="text-orange-500" /> Regras MRV</AlertDialogTitle>
            <div className="py-2 text-sm">Mínimo: R$ 1.500,00.</div>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction className="w-full">OK</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExportContractDialog} onOpenChange={setShowExportContractDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><Tag className="text-primary" /> Aditivo Contrato na Tabela?</AlertDialogTitle>
            <AlertDialogDescription>Informe a porcentagem de aditivo para a exportação PDF.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4"><Input type="number" value={exportContractPercent} onChange={(e) => setExportContractPercent(Number(e.target.value))} onFocus={(e) => e.target.select()} placeholder="Ex: 5" className="text-lg font-bold h-12"/></div>
          <AlertDialogFooter className="gap-2"><AlertDialogCancel className="h-12 flex-1">Voltar</AlertDialogCancel><AlertDialogAction onClick={handleExportTablePDF} className="h-12 flex-1 gap-2 font-bold"><FileDown size={18} /> Gerar PDF</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog do WhatsApp */}
      <AlertDialog open={showZapDialog} onOpenChange={(open) => {
        setShowZapDialog(open);
        if (!open) {
          setZapGeneratedText("");
          setZapSearchTerm("");
        }
      }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <MessageCircle className="text-green-500" /> {zapGeneratedText ? "Texto Gerado" : "Selecionar Itens para Zap"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {zapGeneratedText ? "Copie o texto abaixo para colar no seu aplicativo de mensagens." : "Selecione os produtos e o tipo de carga para gerar a mensagem."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {!zapGeneratedText ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 p-3 bg-muted rounded-lg border">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold uppercase">Aditivo Contrato (%)</Label>
                    <Input type="number" value={zapContractPercent} onChange={(e) => setZapContractPercent(Number(e.target.value))} className="h-10 font-bold" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setZapSelectedIds(filteredProducts.map(p => p.id))}>Todos</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setZapSelectedIds([]); setZapSearchTerm(""); }}>Limpar</Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    placeholder="Filtrar itens..." 
                    className="pl-10 h-10" 
                    value={zapSearchTerm} 
                    onChange={(e) => setZapSearchTerm(e.target.value)} 
                  />
                </div>

                <ScrollArea className="h-[40vh] border rounded-md p-4">
                  <div className="space-y-3">
                    {zapFilteredProducts.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">Nenhum item encontrado.</div>
                    ) : (
                      zapFilteredProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Checkbox 
                              id={`zap-${p.id}`} 
                              checked={zapSelectedIds.includes(p.id)} 
                              onCheckedChange={() => handleToggleZapItem(p.id)}
                            />
                            <label htmlFor={`zap-${p.id}`} className="text-xs font-bold uppercase cursor-pointer truncate">
                              {p.code} - {p.description}
                            </label>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            <Button 
                              variant={zapPriceTypes[p.id] === 'closed' || !zapPriceTypes[p.id] ? 'default' : 'outline'} 
                              size="sm" 
                              className="h-7 text-[10px] px-2"
                              onClick={() => handleSetZapPriceType(p.id, 'closed')}
                            >
                              Fechada
                            </Button>
                            <Button 
                              variant={zapPriceTypes[p.id] === 'fractional' ? 'default' : 'outline'} 
                              size="sm" 
                              className="h-7 text-[10px] px-2"
                              onClick={() => handleSetZapPriceType(p.id, 'fractional')}
                            >
                              Frac
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                <Textarea 
                  value={zapGeneratedText} 
                  readOnly 
                  className="min-h-[40vh] font-mono text-xs bg-slate-50 leading-relaxed"
                />
                <Button variant="outline" className="w-full gap-2 text-primary border-primary" onClick={() => setZapGeneratedText("")}>
                  <ArrowLeft size={16} /> Voltar para Seleção
                </Button>
              </div>
            )}
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12 flex-1">Cancelar</AlertDialogCancel>
            {!zapGeneratedText ? (
              <AlertDialogAction onClick={handleGenerateZapMessage} className="h-12 flex-1 gap-2 font-bold bg-green-600 hover:bg-green-700">
                <MessageCircle size={18} /> Gerar Texto
              </AlertDialogAction>
            ) : (
              <Button onClick={handleCopyZapText} className="h-12 flex-1 gap-2 font-bold bg-blue-600 hover:bg-blue-700">
                <ClipboardCopy size={18} /> Copiar Texto
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-primary">Criar Pedido</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selectedFactoryId !== "none" && lineFilter !== "none" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowZapDialog(true)} className="gap-2 border-green-500 text-green-600 hover:bg-green-50 h-10 px-4">
                <MessageCircle size={16} /> Compartilhar Zap
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowExportContractDialog(true)} disabled={isExporting} className="gap-2 border-accent text-accent hover:bg-accent/5 h-10 px-4">
                {isExporting ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
                Tabela PDF
              </Button>
            </>
          )}
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
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
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
                <div className="flex items-center gap-2">
                  <Plus size={18} className="text-primary" /> Item
                </div>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-[10px] font-bold text-primary flex items-center gap-1"
                  onClick={() => {
                    setIsCustomMode(!isCustomMode);
                    setCategoryFilter("none");
                    setSelectedFactoryId("none");
                    setLineFilter("none");
                  }}
                  disabled={orderItems.length > 0}
                >
                  <Settings2 size={12} />
                  {isCustomMode ? "Modo Simples" : "Personalizar"}
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
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione o tipo..." />
                        </SelectTrigger>
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
                        <Select value={selectedFactoryId} onValueChange={(val) => {
                          setSelectedFactoryId(val);
                          setSelectedProductId("none");
                          setSelectedBrand("all");
                          setProductSearch("");
                          setLineFilter("none");
                        }} disabled={orderItems.length > 0}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Escolha a Fábrica" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedFactoryId !== "none" && (
                        <div className="space-y-1.5 animate-in fade-in duration-300">
                          <Label className="text-xs font-bold uppercase">Linha</Label>
                          <Select value={lineFilter} onValueChange={(val) => { setLineFilter(val); setSelectedBrand("all"); setSelectedProductId("none"); }} disabled={orderItems.length > 0}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a Linha" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Escolha a Linha...</SelectItem>
                              {availableLines.map(line => (
                                <SelectItem key={line} value={line}>
                                  <div className="flex items-center gap-2">
                                    {line.toLowerCase().includes('refrigerada') ? <Snowflake size={12} className="text-blue-500" /> : <Sun size={12} className="text-orange-500" />}
                                    {line}
                                  </div>
                                </SelectItem>
                              ))}
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
                          <Input placeholder="Filtrar por nome/código..." className="pl-10 h-11" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setSelectedProductId("none"); }} />
                        </div>
                        <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={filteredProducts.length === 0}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
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
                          <Label htmlFor="price-closed" className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${priceType === 'closed' ? 'border-primary bg-primary/5 text-primary' : 'border-muted'}`}>
                            <RadioGroupItem value="closed" id="price-closed" className="sr-only" />
                            <span className="font-semibold text-xs text-center">Fechada</span>
                          </Label>
                          <Label htmlFor="price-fractional" className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${priceType === 'fractional' ? 'border-primary bg-primary/5 text-primary' : 'border-muted'}`}>
                            <RadioGroupItem value="fractional" id="price-fractional" className="sr-only" />
                            <span className="font-semibold text-xs text-center">Fracionado</span>
                          </Label>
                        </RadioGroup>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                        <Label className="text-sm font-semibold">Desconto Catálogo</Label>
                        <Switch checked={useCatalogDiscount} onCheckedChange={setUseCatalogDiscount} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label className="text-xs">Qtd (Cxs)</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} onBlur={() => quantity <= 0 && setQuantity(1)} className="font-bold text-lg h-11"/></div>
                        <div className="space-y-1.5"><Label className="text-xs">Contrato (%)</Label><Input type="number" value={contractPercent} onChange={(e) => setContractPercent(Number(e.target.value))} onFocus={(e) => e.target.select()} className="h-11 font-bold text-primary"/></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            
            {unitCalculations && (
              <div className="px-5 py-4 bg-muted/50 border-y space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>Base:</span><span>R$ {formatCurrency(unitCalculations.basePrice)}</span></div>
                {unitCalculations.catalogDiscount > 0 && useCatalogDiscount && (
                  <div className="flex justify-between text-[11px] text-accent font-medium"><span>(-) Desc. Catálogo:</span><span>- R$ {formatCurrency(unitCalculations.catalogDiscount)}</span></div>
                )}
                <div className="flex justify-between text-xs text-accent font-bold"><span>Preço Líquido (NET):</span><span>R$ {formatCurrency(unitCalculations.priceAfterCatalog)}</span></div>
                <div className="flex justify-between text-[11px] text-primary"><span>(+) Contrato:</span><span>+ R$ {formatCurrency(unitCalculations.finalUnitPriceBeforeST - unitCalculations.priceAfterCatalog)}</span></div>
                <div className="flex justify-between text-[11px] text-destructive"><span>(+) ST ({ (unitCalculations.stRate * 100).toFixed(0) }%):</span><span>+ R$ {formatCurrency(unitCalculations.stAmount)}</span></div>
                <div className="pt-2 border-t flex justify-between items-center"><span className="text-sm font-bold">Unitário Final:</span><span className="text-xl font-black text-primary">R$ {formatCurrency(unitCalculations.finalUnitPriceWithST)}</span></div>
              </div>
            )}

            <CardFooter className="pt-4 px-5">
              <Button className="w-full gap-2 h-14 text-lg font-bold shadow-lg" onClick={handleAddProduct} disabled={selectedProductId === "none" || isLoading || !currentCatalogProduct}><Plus size={20} /> Adicionar</Button>
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
                      <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">Item</TableHead><TableHead className="text-center text-xs">Qtd</TableHead><TableHead className="text-right text-xs">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {orderItems.map((item, idx) => (
                          <TableRow key={`${item.productId}-${idx}`}>
                            <TableCell className="py-3">
                              <div className="font-bold text-xs uppercase">{item.name}</div>
                              <div className="text-[9px] text-muted-foreground mt-0.5">{item.priceType === 'closed' ? 'FECHADA' : 'FRAC'} | {item.line}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-full"
                                  onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus size={12} />
                                </Button>
                                <Input 
                                  type="number" 
                                  className="h-8 w-12 text-center p-0 font-bold text-xs" 
                                  value={item.quantity === 0 ? "" : item.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateItemQuantity(idx, val === "" ? 0 : Number(val));
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  onBlur={() => item.quantity <= 0 && updateItemQuantity(idx, 1)}
                                />
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-full"
                                  onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                                >
                                  <Plus size={12} />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-3">
                              <div className="font-black text-primary text-xs">R$ {formatCurrency(item.total)}</div>
                              <div className="text-[9px] text-muted-foreground mt-0.5 font-medium">Unit: R$ {formatCurrency(item.unitPriceFinal)}</div>
                            </TableCell>
                            <TableCell className="text-right pr-2">
                              <Button variant="ghost" size="icon" onClick={() => removeProduct(idx)} className="text-destructive h-8 w-8">
                                <Trash2 size={16} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="p-5 border-t bg-muted/10 space-y-2">
                    <Label className="text-xs font-bold uppercase flex items-center gap-2">
                      <MessageSquare size={14} className="text-primary" /> Observações do Pedido
                    </Label>
                    <Textarea 
                      placeholder="Detalhes de entrega, restrições, etc..." 
                      className="min-h-[80px] bg-white text-xs"
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="bg-primary/5 p-6 flex flex-col border-t gap-5">
                <div className="w-full flex justify-between items-center">
                  <div className="space-y-0.5"><p className="text-[10px] text-muted-foreground uppercase font-black">Total</p><p className="text-3xl font-black text-primary">R$ {formatCurrency(orderTotal)}</p></div>
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border shadow-sm">
                    <Weight size={18} className="text-primary" />
                    <div><p className="text-[9px] text-muted-foreground uppercase font-bold">Peso</p><p className="text-base font-black">{orderTotalWeight.toFixed(2)} Kg</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button variant="outline" className="h-14 border-primary text-primary font-bold" onClick={() => { setOrderItems([]); setCategoryFilter("none"); setSelectedFactoryId("none"); setLineFilter("none"); setObservations(""); }} disabled={isFinalizing}>Limpar</Button>
                  <Button className="h-14 bg-accent hover:bg-accent/90 text-white shadow-lg gap-2 text-lg font-bold" onClick={handleFinalizeOrder} disabled={isFinalizing || selectedCustomerId === "none"}>{isFinalizing ? <Loader2 className="animate-spin" /> : <ReceiptText size={20} />}Finalizar</Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={pdfRef} className="bg-white p-10 w-[800px] text-slate-800" style={{ height: 'auto', minHeight: '100%' }}>
          <div className="flex items-center justify-between border-b-2 border-primary pb-4 mb-2">
            <div className="flex items-center gap-3"><Zap className="text-primary" size={40} /><h1 className="text-3xl font-black text-primary uppercase">Tabela de Preços</h1></div>
            <div className="text-right text-xs">
              <p className="font-bold">{selectedFactory?.name}</p>
              <p className="text-muted-foreground uppercase">{lineFilter}</p>
              <p>{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          {deliveryEstimate && (
            <div className="mb-4 text-center">
              <p className="text-primary font-bold text-sm">Prazo estimado de entrega: Até o dia {deliveryEstimate}</p>
            </div>
          )}
          <table className="w-full text-[10px] border-collapse">
            <thead><tr className="bg-primary text-white"><th className="p-2 text-left border">Cod</th><th className="p-2 text-left border">EAN</th><th className="p-2 text-left border">Descrição</th><th className="p-2 text-right border">Preço NET</th><th className="p-2 text-right border">Final (+ST)</th></tr></thead>
            <tbody>
              {[...filteredProducts].sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true, sensitivity: 'base' })).map((p) => {
                  const catalog = catalogProducts?.find(cp => cp.id === p.catalogProductId);
                  const prices = calculateItemPrices(p, catalog, exportContractPercent);
                  if (!prices) return null;
                  return (<tr key={p.id} className="border-b"><td className="p-2 border font-bold">{p.code}</td><td className="p-2 border">{p.ean}</td><td className="p-2 border uppercase">{p.description}</td><td className="p-2 border text-right">R$ {formatCurrency(prices.finalUnitPriceBeforeST)}</td><td className="p-2 border text-right font-bold text-primary">R$ {formatCurrency(prices.finalUnitPriceWithST)}</td></tr>);
              })}
            </tbody>
          </table>
          <div className="mt-8 border-t pt-4 text-[8px] text-muted-foreground flex justify-between items-center">
            <div className="opacity-30">{exportContractPercent > 0 && (<span>{(exportContractPercent / 10).toFixed(1).replace('.', ',')}</span>)}</div>
            <p className="flex-1 text-center">Gerado eletronicamente por InteliPreço.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
