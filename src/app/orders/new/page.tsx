
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Trash2, Calculator, ReceiptText, ChevronLeft, Zap, ArrowRight, Loader2, AlertCircle, Weight } from "lucide-react";
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
  appliedDiscount: number;
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

  const handleAddProduct = () => {
    if (!currentRegisteredProduct || !currentCatalogProduct) {
      toast({ title: "Erro", description: "Produto inválido ou sem vínculo de preço.", variant: "destructive" });
      return;
    }

    const unitPrice = priceType === 'closed' 
      ? (currentCatalogProduct.closedLoadPrice || 0) 
      : (currentCatalogProduct.fractionalLoadPrice || 0);

    const fixedDiscount = currentCatalogProduct.discountAmount || 0;
    const netPrice = (unitPrice - fixedDiscount) * (1 - (discountPercent || 0) / 100);
    const total = netPrice * (quantity || 1);
    const weight = (currentRegisteredProduct.unitNetWeightKg || 0) * (quantity || 1);

    const totalDiscountPct = unitPrice > 0 ? ((unitPrice - netPrice) / unitPrice) * 100 : 0;

    const newItem: OrderItem = {
      productId: currentRegisteredProduct.id,
      catalogProductId: currentCatalogProduct.id,
      factoryName: factories?.find(f => f.id === selectedFactoryId)?.name || "Fábrica",
      name: currentRegisteredProduct.description,
      unit: currentRegisteredProduct.unit,
      quantity: quantity || 1,
      priceType,
      unitPrice,
      appliedDiscount: Number(totalDiscountPct.toFixed(2)),
      total,
      weight
    };

    setOrderItems([...orderItems, newItem]);
    toast({
      title: "Produto adicionado",
      description: `${currentRegisteredProduct.description} foi adicionado ao pedido.`,
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

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/catalog" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Criar Novo Pedido</h1>
            <p className="text-sm text-muted-foreground">Adicione produtos registrados para compor o pedido.</p>
          </div>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold flex items-center gap-2 self-start md:self-auto">
          <Zap size={18} /> InteliPreço Mobile
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selection Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg border-none">
            <CardHeader className="bg-primary/5 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus size={18} className="text-primary" /> Adicionar Produto
              </CardTitle>
              <CardDescription>Produtos vinculados ao catálogo.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Sincronizando...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Fábrica</Label>
                    <Select value={selectedFactoryId} onValueChange={(val) => {
                      setSelectedFactoryId(val);
                      setSelectedProductId("none");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fábrica" />
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
                        <SelectValue placeholder={selectedFactoryId === "none" ? "Selecione a fábrica primeiro" : filteredProducts.length === 0 ? "Nenhum item vinculado" : "Selecione o produto"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione o produto</SelectItem>
                        {filteredProducts.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.code} - {p.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Qtd ({currentRegisteredProduct?.unit || "-"})</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={quantity} 
                        onChange={(e) => setQuantity(Number(e.target.value))} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Desc. Extra (%)</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={discountPercent} 
                        onChange={(e) => setDiscountPercent(Number(e.target.value))} 
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label>Tipo de Carga</Label>
                    <RadioGroup 
                      value={priceType} 
                      onValueChange={(val: any) => setPriceType(val)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="closed" id="r1" />
                        <Label htmlFor="r1" className="font-normal cursor-pointer">Fechada</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fractional" id="r2" />
                        <Label htmlFor="r2" className="font-normal cursor-pointer">Fracionada</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full gap-2 h-12 text-lg font-semibold" 
                onClick={handleAddProduct}
                disabled={selectedProductId === "none" || isLoading || !currentCatalogProduct}
              >
                <Plus size={18} /> Adicionar
              </Button>
            </CardFooter>
          </Card>

          {currentCatalogProduct && (
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base:</span>
                  <span className="font-semibold">R$ {(priceType === 'closed' ? currentCatalogProduct.closedLoadPrice : currentCatalogProduct.fractionalLoadPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t flex justify-between text-lg font-bold text-primary">
                  <span>Unit. Líquido:</span>
                  <span>
                    R$ {(
                      ((priceType === 'closed' ? currentCatalogProduct.closedLoadPrice : currentCatalogProduct.fractionalLoadPrice) - (currentCatalogProduct.discountAmount || 0)) * 
                      (1 - (discountPercent || 0) / 100)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Details Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-none min-h-[400px] flex flex-col">
            <CardHeader className="bg-primary text-white rounded-t-lg flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <ShoppingCart size={20} /> Carrinho
                </CardTitle>
                <CardDescription className="text-white/80 hidden sm:block">Produtos registrados vinculados.</CardDescription>
              </div>
              <Badge variant="outline" className="text-white border-white/40">{orderItems.length} itens</Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                  <Calculator size={48} className="mb-4 opacity-20" />
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="hidden sm:table-cell">Qtd</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, idx) => (
                        <TableRow key={`${item.productId}-${idx}`}>
                          <TableCell>
                            <div className="font-semibold text-xs sm:text-sm">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{item.factoryName} • {item.quantity} {item.unit}</div>
                            <div className="text-[10px] text-accent font-bold mt-0.5">{item.weight.toFixed(2)} Kg total</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="font-bold text-primary text-xs sm:text-sm whitespace-nowrap">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeProduct(idx)} className="text-destructive h-8 w-8">
                              <Trash2 size={14} />
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
              <CardFooter className="bg-primary/5 p-6 flex flex-col border-t gap-4">
                <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total do Pedido</span>
                    <span className="text-3xl font-extrabold text-primary">R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                    <Weight size={16} className="text-muted-foreground" />
                    <span className="text-sm font-bold text-muted-foreground">Peso: {orderTotalWeight.toFixed(2)} Kg</span>
                  </div>
                </div>
                <div className="flex gap-3 w-full">
                  <Button variant="outline" className="flex-1 border-primary text-primary" onClick={() => setOrderItems([])}>Limpar</Button>
                  <Button className="flex-[2] h-12 bg-accent hover:bg-accent/90 text-white shadow-xl gap-2 group">
                    <ReceiptText size={18} /> Finalizar <ArrowRight className="group-hover:translate-x-1 transition-transform" />
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
