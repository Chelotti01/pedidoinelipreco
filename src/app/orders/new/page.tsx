
"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
import { ShoppingCart, Plus, Trash2, Calculator, ReceiptText, ChevronLeft, Zap, ArrowRight, Loader2, Weight, Tag, Info, Gavel } from "lucide-react";
import Link from 'next/link';

export type OrderItem = {
  productId: string;
  catalogProductId: string;
  factoryName: string;
  name: string;
  unit: string;
  quantity: number;
  priceType: 'closed' | 'fractional';
  unitPrice: number;
  unitPriceWithST: number;
  appliedDiscount: number;
  stRate: number;
  total: number;
  weight: number;
};

export default function NewOrderPage() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories, isLoading: isFactoriesLoading } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => query(collection(db, 'registered_products'), orderBy('description')), [db]);
  const { data: registeredProducts, isLoading: isRegisteredLoading } = useCollection(registeredProductsQuery);

  const catalogProductsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products')), [db]);
  const { data: catalogProducts, isLoading: isCatalogLoading } = useCollection(catalogProductsQuery);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("none");
  const [selectedProductId, setSelectedProductId] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(1);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [useCatalogDiscount, setUseCatalogDiscount] = useState<boolean>(true);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts) return [];
    return registeredProducts.filter(p => 
      p.factoryId === selectedFactoryId && p.catalogProductId
    );
  }, [selectedFactoryId, registeredProducts]);

  const currentRegisteredProduct = useMemo(() => {
    return registeredProducts?.find(p => p.id === selectedProductId);
  }, [selectedProductId, registeredProducts]);

  const currentCatalogProduct = useMemo(() => {
    if (!currentRegisteredProduct?.catalogProductId) return null;
    return catalogProducts?.find(p => p.id === currentRegisteredProduct.catalogProductId);
  }, [currentRegisteredProduct, catalogProducts]);

  // Auxiliar para converter ST string (ex: "10%") em número
  const parseST = (stValue: string | undefined): number => {
    if (!stValue) return 0;
    const cleaned = stValue.replace('%', '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed / 100;
  };

  // Cálculo do Preço Unitário Líquido (Preview)
  const unitCalculations = useMemo(() => {
    if (!currentCatalogProduct) return null;
    
    const basePrice = priceType === 'closed' 
      ? (currentCatalogProduct.closedLoadPrice || 0) 
      : (currentCatalogProduct.fractionalLoadPrice || 0);
    
    const catalogDiscount = useCatalogDiscount ? (currentCatalogProduct.discountAmount || 0) : 0;
    const priceAfterCatalog = Math.max(0, basePrice - catalogDiscount);
    
    // Preço antes do ST (com margem extra)
    const finalUnitPriceBeforeST = priceAfterCatalog * (1 - (discountPercent || 0) / 100);
    
    // Cálculo do ST
    const stRate = parseST(currentRegisteredProduct?.st);
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
  }, [currentCatalogProduct, currentRegisteredProduct, priceType, useCatalogDiscount, discountPercent]);

  const handleAddProduct = () => {
    if (!currentRegisteredProduct || !currentCatalogProduct || !unitCalculations) {
      toast({ title: "Erro", description: "Produto inválido ou sem vínculo de preço.", variant: "destructive" });
      return;
    }

    const { basePrice, finalUnitPriceWithST, finalUnitPriceBeforeST, stRate } = unitCalculations;
    
    const qtyPerBox = currentRegisteredProduct.quantityPerBox || 1;
    // O total do item é: Preço Final (com ST) * Qtd na Caixa * Quantidade de caixas
    const total = finalUnitPriceWithST * qtyPerBox * (quantity || 1);
    
    const weight = (currentRegisteredProduct.boxWeightKg || 0) * (quantity || 1);

    const totalDiscountPct = basePrice > 0 ? ((basePrice - finalUnitPriceBeforeST) / basePrice) * 100 : 0;

    const newItem: OrderItem = {
      productId: currentRegisteredProduct.id,
      catalogProductId: currentCatalogProduct.id,
      factoryName: factories?.find(f => f.id === selectedFactoryId)?.name || "Fábrica",
      name: currentRegisteredProduct.description,
      unit: currentRegisteredProduct.unit,
      quantity: quantity || 1,
      priceType,
      unitPrice: finalUnitPriceBeforeST,
      unitPriceWithST: finalUnitPriceWithST,
      appliedDiscount: Number(totalDiscountPct.toFixed(2)),
      stRate: stRate * 100,
      total,
      weight
    };

    setOrderItems([...orderItems, newItem]);
    toast({
      title: "Produto adicionado",
      description: `${currentRegisteredProduct.description} foi adicionado ao pedido com impostos incluídos.`,
    });

    setSelectedProductId("none");
    setQuantity(1);
    setDiscountPercent(0);
  };

  const removeProduct = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const orderTotal = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.total, 0);
  }, [orderItems]);

  const orderTotalWeight = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.weight, 0);
  }, [orderItems]);

  const isLoading = isFactoriesLoading || isRegisteredLoading || isCatalogLoading;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
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
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold flex items-center gap-2 self-start md:self-auto">
          <Zap size={18} /> InteliPreço Mobile
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
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

                  <div className="space-y-2">
                    <Label>Produto Registrado</Label>
                    <Select 
                      value={selectedProductId} 
                      onValueChange={setSelectedProductId} 
                      disabled={selectedFactoryId === "none" || filteredProducts.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedFactoryId === "none" ? "Aguardando fábrica..." : filteredProducts.length === 0 ? "Nenhum item amarrado" : "Selecione o produto"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione o produto</SelectItem>
                        {filteredProducts.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.code} - {p.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Configuração de Preço</Label>
                    <RadioGroup 
                      value={priceType} 
                      onValueChange={(val: any) => setPriceType(val)}
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

                  {currentCatalogProduct && currentCatalogProduct.discountAmount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-accent" />
                        <div className="text-xs">
                          <p className="font-bold text-accent">Desconto Catálogo</p>
                          <p className="text-muted-foreground">R$ {formatCurrency(currentCatalogProduct.discountAmount)}</p>
                        </div>
                      </div>
                      <Switch 
                        checked={useCatalogDiscount} 
                        onCheckedChange={setUseCatalogDiscount} 
                      />
                    </div>
                  )}

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
                      <Label>Margem Extra (%)</Label>
                      <Input 
                        type="number" 
                        value={discountPercent} 
                        onChange={(e) => setDiscountPercent(Number(e.target.value))} 
                        placeholder="0"
                        className="h-11"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            
            {unitCalculations && (
              <div className="px-6 py-4 bg-muted/50 border-y space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Preço Tabela ({priceType === 'closed' ? 'Fechada' : 'Fracionada'}):</span>
                  <span>R$ {formatCurrency(unitCalculations.basePrice)}</span>
                </div>
                {useCatalogDiscount && unitCalculations.catalogDiscount > 0 && (
                  <div className="flex justify-between text-xs text-accent font-medium">
                    <span>(-) Desconto Catálogo:</span>
                    <span>- R$ {formatCurrency(unitCalculations.catalogDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal (C/ Margem Extra):</span>
                  <span>R$ {formatCurrency(unitCalculations.finalUnitPriceBeforeST)}</span>
                </div>
                <div className="flex justify-between text-xs text-destructive font-medium">
                  <span className="flex items-center gap-1"><Gavel size={12} /> (+) Imposto ST ({ (unitCalculations.stRate * 100).toFixed(0) }%):</span>
                  <span>+ R$ {formatCurrency(unitCalculations.stAmount)}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Unitário Líquido + ST:</span>
                    <span className="text-[10px] text-muted-foreground">Preço final com impostos</span>
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
                <CardDescription className="text-white/80">Itens com impostos e descontos aplicados.</CardDescription>
              </div>
              <Badge variant="outline" className="text-white border-white/40 px-3 py-1 font-bold">
                {orderItems.length} {orderItems.length === 1 ? 'Item' : 'Itens'}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center opacity-20">
                    <Calculator size={48} />
                  </div>
                  <p className="font-medium">Nenhum produto adicionado ao pedido.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[300px]">Produto</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Preço Final (+ST)</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, idx) => (
                        <TableRow key={`${item.productId}-${idx}`} className="group hover:bg-muted/20">
                          <TableCell>
                            <div className="font-bold text-sm">{item.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px] py-0">{item.factoryName}</Badge>
                              <span className="text-[10px] text-muted-foreground">{item.priceType === 'closed' ? 'Carga Fechada' : 'Fracionado'}</span>
                              <Badge variant="outline" className="text-[10px] py-0 text-destructive border-destructive/20">+ {item.stRate.toFixed(0)}% ST</Badge>
                            </div>
                            <div className="text-[10px] text-accent font-bold mt-1 flex items-center gap-1">
                              <Weight size={10} /> {item.weight.toFixed(2)} Kg
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium text-xs">
                            {item.quantity} cx
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            R$ {formatCurrency(item.unitPriceWithST)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            R$ {formatCurrency(item.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeProduct(idx)} 
                              className="text-destructive h-8 w-8 hover:bg-destructive/10"
                            >
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
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Valor Total Líquido (C/ Impostos)</p>
                    <p className="text-4xl font-black text-primary">R$ {formatCurrency(orderTotal)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border shadow-sm">
                      <Weight size={20} className="text-primary" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Peso Total (Carga)</p>
                        <p className="text-lg font-extrabold text-foreground">{orderTotalWeight.toFixed(2)} Kg</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <Button variant="outline" className="h-14 border-primary text-primary font-bold" onClick={() => setOrderItems([])}>
                    Esvaziar Carrinho
                  </Button>
                  <Button className="h-14 bg-accent hover:bg-accent/90 text-white shadow-xl gap-2 group text-lg font-bold">
                    <ReceiptText size={20} /> Finalizar Pedido <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
          
          <div className="p-4 bg-muted rounded-xl flex gap-3 items-start border">
            <Info className="text-primary shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Cálculo do Preço:</strong> O preço apresentado já inclui o imposto ST (Substituição Tributária) conforme a alíquota cadastrada no produto paralelo.</p>
              <p><strong>Nota Logística:</strong> O peso do pedido utiliza o Peso da Caixa multiplicado pela quantidade de caixas.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
