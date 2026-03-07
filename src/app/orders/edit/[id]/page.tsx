"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc, useUser } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
  ShoppingCart, Plus, Trash2, Calculator, ReceiptText, 
  Loader2, Weight, User, Search, Minus, Save, Gift, ArrowLeft, Edit
} from "lucide-react";
import Link from 'next/link';
import { OrderItem } from '@/app/orders/new/page';

export default function EditOrderPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Obter organização do perfil
  const userProfileQuery = useMemoFirebase(() => 
    user?.email ? query(collection(db, 'userProfiles'), where('email', '==', user.email), limit(1)) : null
  , [db, user]);
  const { data: profiles } = useCollection(userProfileQuery);
  const profile = profiles?.[0];
  const orgId = profile?.organizationId;

  // Carregar o pedido existente
  const orderRef = useMemoFirebase(() => 
    (id && orgId) ? doc(db, 'organizations', orgId, 'orders', id) : null
  , [db, id, orgId]);
  const { data: order, isLoading: isOrderLoading } = useDoc(orderRef);
  
  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null
  , [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  const registeredProductsQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'products'), orderBy('description')) : null
  , [db, orgId]);
  const { data: registeredProducts } = useCollection(registeredProductsQuery);

  const catalogProductsQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices')) : null
  , [db, orgId]);
  const { data: catalogProducts } = useCollection(catalogProductsQuery);

  const customersQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'clients'), orderBy('name', 'asc')) : null
  , [db, orgId]);
  const { data: customers } = useCollection(customersQuery);

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
  const [quantity, setQuantity] = useState<number>(1);
  const [priceType, setPriceType] = useState<'closed' | 'fractional'>('closed');
  const [contractPercent, setContractPercent] = useState<number>(0);
  const [isBonus, setIsBonus] = useState(false);

  useEffect(() => {
    if (order && !isOrderLoading) {
      setSelectedCustomerId(order.customerId || "none");
      setOrderItems(order.items || []);
      setManualObservations(order.notes?.split('\n\n--- RESUMO DE BONIFICAÇÃO ---')[0] || "");
      
      if (order.items && order.items.length > 0) {
        const firstItem = order.items[0];
        const prod = registeredProducts?.find(p => p.id === firstItem.productId);
        if (prod) {
          setSelectedFactoryId(prod.factoryId);
          setLineFilter(prod.line);
        }
      }
    }
  }, [order, isOrderLoading, registeredProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedFactoryId === "none" || !registeredProducts || lineFilter === "none") return [];
    let filtered = registeredProducts.filter(p => p.factoryId === selectedFactoryId && p.catalogProductId && p.line === lineFilter);
    if (selectedBrand !== "all") filtered = filtered.filter(p => p.brand === selectedBrand);
    if (productSearch.trim()) {
      const term = productSearch.toLowerCase();
      filtered = filtered.filter(p => p.code?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term));
    }
    return filtered;
  }, [selectedFactoryId, registeredProducts, productSearch, lineFilter, selectedBrand]);

  const currentRegisteredProduct = useMemo(() => registeredProducts?.find(p => p.id === selectedProductId), [selectedProductId, registeredProducts]);
  const currentCatalogProduct = useMemo(() => catalogProducts?.find(p => p.id === currentRegisteredProduct?.catalogProductId), [currentRegisteredProduct, catalogProducts]);

  const handleAddProduct = () => {
    if (!currentRegisteredProduct || !currentCatalogProduct || !orgId) return;
    
    if (orderItems.length > 0 && currentRegisteredProduct.line !== orderItems[0].line) {
      toast({ title: "Erro de Linha", description: "O pedido deve conter apenas itens da mesma linha.", variant: "destructive" });
      return;
    }

    const basePrice = priceType === 'closed' ? (currentCatalogProduct.closedLoadPrice || 0) : (currentCatalogProduct.fractionalLoadPrice || 0);
    const surcharge = currentRegisteredProduct.customSurchargeValue || 0;
    const net = (basePrice - (currentCatalogProduct.discountAmount || 0) + surcharge) * (1 + contractPercent / 100);
    const stRate = parseFloat(currentRegisteredProduct.st || '0') / 100;
    const final = net * (1 + stRate);

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
      unitPriceNet: net,
      unitPriceFinal: final,
      appliedContract: contractPercent,
      stRate: stRate * 100,
      total: isBonus ? 0 : (final * (currentRegisteredProduct.quantityPerBox || 1) * quantity),
      weight: isBonus ? 0 : ((currentRegisteredProduct.boxWeightKg || 0) * quantity),
      line: currentRegisteredProduct.line || '',
      quantityPerBox: currentRegisteredProduct.quantityPerBox || 1,
      unitWeight: currentRegisteredProduct.boxWeightKg || 0,
      isBonus
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProductId("none");
    setQuantity(1);
  };

  const handleProcessOrder = async (status: 'DRAFT' | 'CONFIRMED') => {
    if (!orderRef || !orgId) return;
    status === 'DRAFT' ? setIsSavingDraft(true) : setIsFinalizing(true);

    try {
      updateDocumentNonBlocking(orderRef, {
        customerId: selectedCustomerId,
        customerName: customers?.find(c => c.id === selectedCustomerId)?.name || 'Cliente',
        items: orderItems,
        notes: manualObservations,
        totalAmount: orderItems.reduce((acc, i) => acc + i.total, 0),
        totalWeight: orderItems.reduce((acc, i) => acc + i.weight, 0),
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Pedido atualizado" });
      router.push('/orders/history');
    } catch (e) {
      status === 'DRAFT' ? setIsSavingDraft(false) : setIsFinalizing(false);
    }
  };

  if (isOrderLoading || !orgId) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/orders/history" className="text-muted-foreground hover:text-primary">
          <ArrowLeft size={28} />
        </Link>
        <h1 className="text-2xl font-black text-primary flex items-center gap-2">
          <Edit size={24} /> Editar Pedido #{id?.slice(-6).toUpperCase()}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lógica de interface similar à NewOrderPage, adaptada para edição */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md">
            <CardHeader className="bg-primary/5"><CardTitle className="text-sm uppercase font-bold">Cliente</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          {/* ... Restante do formulário de adição de itens ... */}
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-xl">
            <CardHeader className="bg-primary text-white flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart size={20} /> Itens do Pedido</CardTitle>
              <Badge variant="secondary" className="font-bold">{orderItems.length} Itens</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {orderItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-3">
                        <div className="font-bold text-xs">{item.code}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{item.name}</div>
                      </TableCell>
                      <TableCell className="text-center font-bold">{item.quantity} cx</TableCell>
                      <TableCell className="text-right font-black">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}><Trash2 size={16} /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 border-t bg-muted/10">
                <Label className="text-xs font-bold uppercase">Observações Internas</Label>
                <Textarea value={manualObservations} onChange={(e) => setManualObservations(e.target.value)} className="mt-2 text-xs" />
              </div>
            </CardContent>
            <CardFooter className="bg-primary/5 p-6 flex flex-col gap-4">
              <div className="w-full flex justify-between items-center font-black">
                <span className="text-muted-foreground">VALOR TOTAL:</span>
                <span className="text-2xl text-primary font-black">R$ {orderItems.reduce((acc, i) => acc + i.total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                <Button variant="secondary" className="h-12 font-bold" onClick={() => handleProcessOrder('DRAFT')} disabled={isSavingDraft || isFinalizing}>Atualizar Rascunho</Button>
                <Button className="h-12 font-bold bg-accent" onClick={() => handleProcessOrder('CONFIRMED')} disabled={isSavingDraft || isFinalizing}>Finalizar Pedido</Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
