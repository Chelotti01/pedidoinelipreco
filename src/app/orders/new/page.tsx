
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
import { ShoppingCart, Plus, Trash2, Calculator, ReceiptText, ChevronLeft, Zap, ArrowRight, Loader2 } from "lucide-react";
import Link from 'next/link';

export type OrderItem = {
  productId: string;
  factoryName: string;
  name: string;
  unit: string;
  quantity: number;
  priceType: 'closed' | 'fractional';
  unitPrice: number;
  appliedDiscount: number;
  total: number;
};

export default function NewOrderPage() {
  const db = useFirestore();
  const { toast } = useToast();
  
  // Firestore Data
  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories, isLoading: isFactoriesLoading } = useCollection(factoriesQuery);

  const productsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products'), orderBy('name')), [db]);
  const { data: catalogProducts, isLoading: isProductsLoading } = useCollection(productsQuery);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // New Item State
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("none");
  const [selectedProductId, setSelectedProductId] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(1);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const currentFactory = useMemo(() => {
    return factories?.find(f => f.id === selectedFactoryId);
  }, [selectedFactoryId, factories]);

  const currentProduct = useMemo(() => {
    return catalogProducts?.find(p => p.id === selectedProductId);
  }, [selectedProductId, catalogProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none") return [];
    return catalogProducts?.filter(p => p.factoryId === selectedFactoryId) || [];
  }, [selectedFactoryId, catalogProducts]);

  const handleAddProduct = () => {
    if (!currentProduct || !currentFactory) return;

    const unitPrice = priceType === 'closed' 
      ? currentProduct.closedLoadPrice 
      : currentProduct.fractionalLoadPrice;

    // Usamos o desconto que vem do catálogo se disponível, ou o manual
    const discountToApply = currentProduct.discountAmount && unitPrice > 0 
      ? (currentProduct.discountAmount / unitPrice) * 100 
      : discountPercent;
    
    const discountValue = discountToApply / 100;
    const discountedUnitPrice = unitPrice * (1 - discountValue);
    const total = discountedUnitPrice * quantity;

    const newItem: OrderItem = {
      productId: currentProduct.id,
      factoryName: currentFactory.name,
      name: currentProduct.name,
      unit: currentProduct.unit,
      quantity,
      priceType,
      unitPrice,
      appliedDiscount: Number(discountToApply.toFixed(2)),
      total
    };

    setOrderItems([...orderItems, newItem]);
    toast({
      title: "Produto adicionado",
      description: `${currentProduct.name} foi adicionado ao pedido.`,
    });

    // Reset fields
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

  const isLoading = isFactoriesLoading || isProductsLoading;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/catalog" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Criar Novo Pedido</h1>
            <p className="text-muted-foreground">Adicione produtos, aplique descontos e visualize o total dinâmico.</p>
          </div>
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold flex items-center gap-2">
          <Zap size={18} /> Pedido InteliPreço
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
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-primary" />
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
                    <Label>Produto</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={selectedFactoryId === "none"}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione o produto</SelectItem>
                        {filteredProducts.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantidade ({currentProduct?.unit || "-"})</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={quantity} 
                        onChange={(e) => setQuantity(Number(e.target.value))} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Desconto Extra (%)</Label>
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
                        <Label htmlFor="r1" className="font-normal cursor-pointer">Carga Fechada</Label>
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
                disabled={selectedProductId === "none" || isLoading}
              >
                <Plus size={18} /> Adicionar ao Carrinho
              </Button>
            </CardFooter>
          </Card>

          {/* Current Selection Price Preview */}
          {currentProduct && (
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço Unitário (Base):</span>
                  <span className="font-semibold">R$ {(priceType === 'closed' ? currentProduct.closedLoadPrice : currentProduct.fractionalLoadPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {(currentProduct.discountAmount > 0 || discountPercent > 0) && (
                   <div className="flex justify-between text-accent">
                    <span>Desconto Aplicado:</span>
                    <span>
                      {currentProduct.discountAmount > 0 
                        ? `R$ ${currentProduct.discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                        : `${discountPercent}%`}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between text-lg font-bold text-primary">
                  <span>Subtotal Previsto:</span>
                  <span>
                    R$ {(
                      ((priceType === 'closed' ? currentProduct.closedLoadPrice : currentProduct.fractionalLoadPrice) - (currentProduct.discountAmount || 0)) * 
                      (1 - discountPercent / 100) * 
                      quantity
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Details Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-none min-h-[500px] flex flex-col">
            <CardHeader className="bg-primary text-white rounded-t-lg flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <ShoppingCart size={20} /> Resumo do Pedido
                </CardTitle>
                <CardDescription className="text-white/80">Revise os itens e o total calculado.</CardDescription>
              </div>
              <Badge variant="outline" className="text-white border-white/40">Itens: {orderItems.length}</Badge>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                  <Calculator size={48} className="mb-4 opacity-20" />
                  <p>Adicione produtos para começar o pedido.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Fábrica</TableHead>
                        <TableHead>Preço/Un</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, idx) => (
                        <TableRow key={`${item.productId}-${idx}`}>
                          <TableCell>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-xs text-muted-foreground uppercase">{item.priceType === 'closed' ? 'Carga Fechada' : 'Fracionada'}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{item.factoryName}</Badge></TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            {item.appliedDiscount > 0 && (
                              <div className="text-[10px] text-accent font-bold">-{item.appliedDiscount}% OFF</div>
                            )}
                          </TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell className="font-bold text-primary">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeProduct(idx)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
              <CardFooter className="bg-primary/5 p-8 flex flex-col md:flex-row items-center justify-between border-t gap-6">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground uppercase font-bold tracking-wider">Total do Pedido</span>
                  <span className="text-4xl font-extrabold text-primary">R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <Button variant="outline" className="flex-1 md:flex-none border-primary text-primary hover:bg-primary/5" onClick={() => setOrderItems([])}>Limpar</Button>
                  <Button className="flex-1 md:flex-none h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-white shadow-xl hover:shadow-accent/20 gap-2 group">
                    <ReceiptText size={20} /> Finalizar Pedido <ArrowRight className="group-hover:translate-x-1 transition-transform" />
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
