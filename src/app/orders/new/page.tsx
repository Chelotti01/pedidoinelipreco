
"use client"

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
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
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Trash2, Calculator, ReceiptText, ChevronLeft, Zap, ArrowRight, 
  Loader2, Weight, Tag, Info, Gavel, User, AlertTriangle, Search, Snowflake, Sun, FileDown 
} from "lucide-react";
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
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
};

export default function NewOrderPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories, isLoading: isFactoriesLoading } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => query(collection(db, 'registered_products'), orderBy('description')), [db]);
  const { data: registeredProducts, isLoading: isRegisteredLoading } = useCollection(registeredProductsQuery);

  const catalogProductsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products')), [db]);
  const { data: catalogProducts, isLoading: isCatalogLoading } = useCollection(catalogProductsQuery);

  const customersQuery = useMemoFirebase(() => query(collection(db, 'customers'), orderBy('name', 'asc')), [db]);
  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("none");
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("none");
  const [selectedProductId, setSelectedProductId] = useState<string>("none");
  const [productSearch, setProductSearch] = useState<string>("");
  const [lineFilter, setLineFilter] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(1);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [useCatalogDiscount, setUseCatalogDiscount] = useState<boolean>(true);
  const [contractPercent, setContractPercent] = useState<number>(0);
  
  const [showAraRulesDialog, setShowAraRulesDialog] = useState(false);

  const selectedFactory = useMemo(() => {
    return factories?.find(f => f.id === selectedFactoryId);
  }, [selectedFactoryId, factories]);

  useEffect(() => {
    if (selectedFactory?.name?.toUpperCase().includes('ARA') && lineFilter?.toUpperCase().includes('SECA UHT')) {
      setShowAraRulesDialog(true);
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

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts || lineFilter === "none") return [];
    
    let filtered = registeredProducts.filter(p => 
      p.factoryId === selectedFactoryId && p.catalogProductId
    );

    filtered = filtered.filter(p => p.line === lineFilter);

    if (productSearch.trim()) {
      const term = productSearch.toLowerCase();
      filtered = filtered.filter(p => 
        p.code?.toLowerCase().includes(term) || 
        p.description?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [selectedFactoryId, registeredProducts, productSearch, lineFilter]);

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

  const calculateItemPrices = (registeredItem: any, catalogItem: any) => {
    if (!registeredItem || !catalogItem) return null;

    const basePrice = priceType === 'closed' 
      ? (catalogItem.closedLoadPrice || 0) 
      : (catalogItem.fractionalLoadPrice || 0);
    
    const catalogDiscount = useCatalogDiscount ? (catalogItem.discountAmount || 0) : 0;
    const priceAfterCatalog = Math.max(0, basePrice - catalogDiscount);
    
    const finalUnitPriceBeforeST = priceAfterCatalog * (1 + (contractPercent || 0) / 100);
    
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
        description: `Este pedido já contém itens da linha "${orderItems[0].line}". Para adicionar itens da linha "${currentRegisteredProduct.line}", finalize ou limpe o carrinho atual.`, 
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
      line: currentRegisteredProduct.line || ''
    };

    setOrderItems([...orderItems, newItem]);
    toast({
      title: "Produto adicionado",
      description: `${currentRegisteredProduct.description} adicionado ao carrinho.`,
    });

    setSelectedProductId("none");
    setProductSearch("");
    setQuantity(1);
    setContractPercent(0);
  };

  const handleFinalizeOrder = async () => {
    if (orderItems.length === 0) return;
    if (selectedCustomerId === "none") {
      toast({ title: "Cliente obrigatório", description: "Por favor, selecione um cliente para o pedido.", variant: "destructive" });
      return;
    }

    const totalQty = orderItems.reduce((acc, item) => acc + item.quantity, 0);
    const isAraSecaUht = selectedFactory?.name?.toUpperCase().includes('ARA') && orderItems[0]?.line?.toUpperCase().includes('SECA UHT');

    if (isAraSecaUht) {
      if (totalQty < 30) {
        toast({ 
          title: "Pedido Inválido", 
          description: `A somatória total dos produtos (${totalQty} cx) é inferior ao mínimo de 30 cxs exigido para esta linha.`, 
          variant: "destructive" 
        });
        return;
      }

      if (totalQty >= 30 && totalQty <= 130) {
        const hasWrongPriceType = orderItems.some(item => item.priceType !== 'fractional');
        if (hasWrongPriceType) {
          toast({ 
            title: "Ajuste de Preço Necessário", 
            description: "Para pedidos entre 30 e 130 caixas, todos os itens devem estar como 'Fracionado'. Altere a configuração acima para atualizar o carrinho.", 
            variant: "destructive" 
          });
          return;
        }
      }

      if (totalQty > 130) {
        const hasWrongPriceType = orderItems.some(item => item.priceType !== 'closed');
        if (hasWrongPriceType) {
          toast({ 
            title: "Ajuste de Preço Necessário", 
            description: "Para pedidos acima de 130 caixas, todos os itens devem estar como 'Carga Fechada'. Altere a configuração acima para atualizar o carrinho.", 
            variant: "destructive" 
          });
          return;
        }
      }
    }

    setIsFinalizing(true);
    const orderData = {
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Cliente Desconhecido',
      items: orderItems,
      totalAmount: orderTotal,
      totalWeight: orderTotalWeight,
      createdAt: serverTimestamp(),
    };

    try {
      await addDocumentNonBlocking(collection(db, 'orders'), orderData);
      toast({
        title: "Pedido Finalizado!",
        description: "O pedido foi gravado no histórico com sucesso.",
      });
      router.push('/orders/history');
    } catch (error) {
      toast({
        title: "Erro ao salvar pedido",
        description: "Ocorreu um problema ao gravar no banco de dados.",
        variant: "destructive"
      });
      setIsFinalizing(false);
    }
  };

  const removeProduct = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    if (updatedItems.length === 0) {
      setLineFilter("none");
    }
  };

  const orderTotal = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.total, 0);
  }, [orderItems]);

  const orderTotalWeight = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.weight, 0);
  }, [orderItems]);

  const isLoading = isFactoriesLoading || isRegisteredLoading || isCatalogLoading || isCustomersLoading;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const handleExportTablePDF = async () => {
    if (!pdfRef.current || filteredProducts.length === 0) return;
    
    setIsExporting(true);
    toast({ title: "Gerando Tabela PDF", description: "Aguarde o processamento..." });

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`tabela_precos_${selectedFactory?.name}_${lineFilter}.pdf`);
      
      toast({ title: "Sucesso", description: "Tabela exportada com sucesso!" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <AlertDialog open={showAraRulesDialog} onOpenChange={setShowAraRulesDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle className="text-orange-500" /> Regras Comerciais ARA
            </AlertDialogTitle>
            <div className="space-y-4 py-2 text-foreground text-sm">
              <div className="font-bold border-b pb-2 text-sm">Para a linha SECA UHT, observe as condições obrigatórias:</div>
              <ul className="space-y-3 list-disc pl-4">
                <li>O pedido mínimo é de <span className="font-black">30 caixas no total</span>.</li>
                <li>De <span className="font-black">30 a 130 caixas (total)</span>: O pedido deve ser <span className="font-bold text-primary">Fracionado</span>.</li>
                <li>Acima de <span className="font-black">130 caixas (total)</span>: O pedido deve ser <span className="font-bold text-primary">Carga Fechada</span>.</li>
              </ul>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="w-full">Entendido, prosseguir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/catalog" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Criar Novo Pedido</h1>
            <p className="text-sm text-muted-foreground">Monte seu carrinho com preços dinâmicos e impostos (ST).</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedFactoryId !== "none" && lineFilter !== "none" && (
            <Button variant="outline" size="sm" onClick={handleExportTablePDF} disabled={isExporting} className="gap-2 border-accent text-accent hover:bg-accent/5">
              {isExporting ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
              Exportar Tabela PDF
            </Button>
          )}
          <Link href="/orders/history">
            <Button variant="outline" size="sm">Histórico de Pedidos</Button>
          </Link>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold flex items-center gap-2 self-start md:self-auto">
            <Zap size={18} /> InteliPreço
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg border-none">
             <CardHeader className="bg-accent/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User size={18} className="text-accent" /> Seleção do Cliente
                </CardTitle>
             </CardHeader>
             <CardContent className="pt-6">
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escolha um cliente...</SelectItem>
                    {customers?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.cnpj})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer && (
                  <div className="mt-3 p-3 bg-muted rounded-md text-[10px] space-y-1">
                    <p><strong>CNPJ:</strong> {selectedCustomer.cnpj}</p>
                    <p><strong>Prazo:</strong> {selectedCustomer.paymentTerm}</p>
                    <p><strong>Tipo Carga:</strong> {selectedCustomer.loadType}</p>
                  </div>
                )}
             </CardContent>
          </Card>

          <Card className="shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus size={18} className="text-primary" /> Adicionar Item
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Sincronizando banco de dados...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Selecione a Fábrica</Label>
                    <Select value={selectedFactoryId} onValueChange={(val) => {
                      setSelectedFactoryId(val);
                      setSelectedProductId("none");
                      setProductSearch("");
                      setLineFilter("none");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a fábrica" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione uma fábrica</SelectItem>
                        {factories?.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedFactoryId !== "none" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <Label className="text-xs">Linha (Obrigatório)</Label>
                        <Select 
                          value={lineFilter} 
                          onValueChange={setLineFilter}
                          disabled={orderItems.length > 0}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione a Linha" />
                          </SelectTrigger>
                          <SelectContent>
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

                      {lineFilter !== "none" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="space-y-2">
                            <div className="relative mb-2">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                              <Input 
                                placeholder="Digite o código ou nome para filtrar..." 
                                className="pl-10 h-10 font-medium"
                                value={productSearch}
                                onChange={(e) => {
                                  setProductSearch(e.target.value);
                                  setSelectedProductId("none");
                                }}
                              />
                            </div>
                            <Label className="text-[10px] text-muted-foreground uppercase font-bold px-1">Selecione o Produto</Label>
                            <Select 
                              value={selectedProductId} 
                              onValueChange={setSelectedProductId} 
                              disabled={filteredProducts.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={filteredProducts.length === 0 ? "Nenhum resultado" : "Escolha na lista filtrada..."} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Selecione o produto</SelectItem>
                                {filteredProducts.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.code} - {p.description}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProductId !== "none" && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Configuração de Preço</Label>
                        <RadioGroup 
                          value={priceType} 
                          onValueChange={(val: any) => handlePriceTypeChange(val)}
                          className="grid grid-cols-2 gap-2"
                        >
                          <Label
                            htmlFor="price-closed"
                            className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${priceType === 'closed' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-transparent'}`}
                          >
                            <RadioGroupItem value="closed" id="price-closed" className="sr-only" />
                            <span className="font-semibold text-xs">Carga Fechada</span>
                          </Label>
                          <Label
                            htmlFor="price-fractional"
                            className={`flex items-center justify-center gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${priceType === 'fractional' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-transparent'}`}
                          >
                            <RadioGroupItem value="fractional" id="price-fractional" className="sr-only" />
                            <span className="font-semibold text-xs">Fracionado</span>
                          </Label>
                        </RadioGroup>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Aplicar Desconto Catálogo</Label>
                          {currentCatalogProduct && (
                            <p className="text-[10px] text-muted-foreground">Subtrair R$ {currentCatalogProduct.discountAmount?.toLocaleString('pt-BR')} do preço base</p>
                          )}
                        </div>
                        <Switch 
                          checked={useCatalogDiscount} 
                          onCheckedChange={setUseCatalogDiscount} 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantidade (Caixas)</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            value={quantity} 
                            onChange={(e) => setQuantity(Number(e.target.value))} 
                            className="font-bold text-lg h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Contrato (%)</Label>
                          <Input 
                            type="number" 
                            value={contractPercent} 
                            onChange={(e) => setContractPercent(Number(e.target.value))} 
                            placeholder="0"
                            className="h-11 font-bold text-primary"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            
            {unitCalculations && (
              <div className="px-6 py-4 bg-muted/50 border-y space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Preço Tabela ({priceType === 'closed' ? 'Fechada' : 'Frac'}):</span>
                  <span>R$ {formatCurrency(unitCalculations.basePrice)}</span>
                </div>
                {unitCalculations.catalogDiscount > 0 && useCatalogDiscount && (
                  <div className="flex justify-between text-xs text-accent font-medium">
                    <span>(-) Desconto Catálogo:</span>
                    <span>- R$ {formatCurrency(unitCalculations.catalogDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-accent font-bold">
                  <span>Preço Líquido (NET):</span>
                  <span>R$ {formatCurrency(unitCalculations.priceAfterCatalog)}</span>
                </div>
                <div className="flex justify-between text-xs text-primary font-medium">
                  <span>(+) Aditivo Contrato ({contractPercent}%):</span>
                  <span>+ R$ {formatCurrency(unitCalculations.finalUnitPriceBeforeST - unitCalculations.priceAfterCatalog)}</span>
                </div>
                <div className="flex justify-between text-xs text-destructive font-medium">
                  <span className="flex items-center gap-1"><Gavel size={12} /> (+) Imposto ST ({ (unitCalculations.stRate * 100).toFixed(0) }%):</span>
                  <span>+ R$ {formatCurrency(unitCalculations.stAmount)}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Unitário Final:</span>
                  </div>
                  <span className="text-xl font-extrabold text-primary">R$ {formatCurrency(unitCalculations.finalUnitPriceWithST)}</span>
                </div>
              </div>
            )}

            <CardFooter className="pt-4">
              <Button 
                className="w-full gap-2 h-14 text-lg font-bold shadow-lg" 
                onClick={handleAddProduct}
                disabled={selectedProductId === "none" || isLoading || !currentCatalogProduct}
              >
                <Plus size={20} /> Adicionar ao Pedido
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xl border-none flex flex-col min-h-[500px]">
            <CardHeader className="bg-primary text-white rounded-t-lg flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <ShoppingCart size={22} /> Resumo do Carrinho
                </CardTitle>
                <CardDescription className="text-white/80">
                  {selectedCustomer ? `Pedido para: ${selectedCustomer.name}` : 'Selecione um cliente para finalizar'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-white border-white/40 px-3 py-1 font-bold">
                {orderItems.length} Itens
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center opacity-20">
                    <Calculator size={48} />
                  </div>
                  <p className="font-medium">Carrinho vazio.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[300px]">Produto</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Unitário Final</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, idx) => (
                        <TableRow key={`${item.productId}-${idx}`}>
                          <TableCell>
                            <div className="font-bold text-sm">{item.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px] py-0">{item.factoryName}</Badge>
                              <span className="text-[10px] text-muted-foreground">{item.priceType === 'closed' ? 'Carga Fechada' : 'Fracionado'}</span>
                              <Badge variant="outline" className="text-[9px] py-0 border-primary text-primary">{item.line}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium text-xs">
                            {item.quantity} cx
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            R$ {formatCurrency(item.unitPriceFinal)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            R$ {formatCurrency(item.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => removeProduct(idx)} className="text-destructive h-8 w-8 hover:bg-destructive/10">
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            {orderItems.length > 0 && (
              <CardFooter className="bg-primary/5 p-8 flex flex-col border-t gap-6">
                <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Valor Total Líquido</p>
                    <p className="text-4xl font-black text-primary">R$ {formatCurrency(orderTotal)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border shadow-sm">
                      <Weight size={20} className="text-primary" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Peso Total</p>
                        <p className="text-lg font-extrabold text-foreground">{orderTotalWeight.toFixed(2)} Kg</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <Button variant="outline" className="h-14 border-primary text-primary font-bold" onClick={() => {
                    setOrderItems([]);
                    setLineFilter("none");
                  }} disabled={isFinalizing}>
                    Limpar
                  </Button>
                  <Button 
                    className="h-14 bg-accent hover:bg-accent/90 text-white shadow-xl gap-2 text-lg font-bold"
                    onClick={handleFinalizeOrder}
                    disabled={isFinalizing || selectedCustomerId === "none"}
                  >
                    {isFinalizing ? <Loader2 className="animate-spin" /> : <ReceiptText size={20} />}
                    Finalizar Pedido
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* Tabela Oculta para Geração de PDF */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={pdfRef} className="bg-white p-10 w-[800px] text-slate-800">
          <div className="flex items-center justify-between border-b-2 border-primary pb-4 mb-6">
            <div className="flex items-center gap-3">
              <Zap className="text-primary" size={40} />
              <h1 className="text-3xl font-black text-primary uppercase">Tabela de Preços</h1>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">{selectedFactory?.name}</p>
              <p className="text-muted-foreground uppercase">{lineFilter}</p>
              <p>{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-primary text-white">
                <th className="p-2 text-left border">Cod</th>
                <th className="p-2 text-left border">EAN</th>
                <th className="p-2 text-left border">Descrição</th>
                <th className="p-2 text-right border">Preço NET</th>
                <th className="p-2 text-right border">Final (+ST)</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => {
                const catalog = catalogProducts?.find(cp => cp.id === p.catalogProductId);
                const prices = calculateItemPrices(p, catalog);
                if (!prices) return null;
                return (
                  <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border font-bold">{p.code}</td>
                    <td className="p-2 border">{p.ean}</td>
                    <td className="p-2 border uppercase">{p.description}</td>
                    <td className="p-2 border text-right">R$ {formatCurrency(prices.finalUnitPriceBeforeST)}</td>
                    <td className="p-2 border text-right font-bold text-primary">R$ {formatCurrency(prices.finalUnitPriceWithST)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div className="mt-8 border-t pt-4 text-[8px] text-muted-foreground text-center">
            <p>Gerado eletronicamente por InteliPreço. Valores vigentes sujeitos a alteração por parte da fábrica.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
