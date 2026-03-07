"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, Tag, Loader2, DollarSign, Percent } from "lucide-react";
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditRegisteredProductPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Obter organização do perfil
  const userProfileQuery = useMemoFirebase(() => 
    user?.email ? query(collection(db, 'userProfiles'), where('email', '==', user.email), limit(1)) : null
  , [db, user]);
  const { data: profiles } = useCollection(userProfileQuery);
  const profile = profiles?.[0];
  const orgId = profile?.organizationId;

  // Documento dentro da sub-coleção products da organização
  const productRef = useMemoFirebase(() => 
    (id && orgId) ? doc(db, 'organizations', orgId, 'products', id) : null
  , [db, id, orgId]);
  const { data: product, isLoading: isProductLoading } = useDoc(productRef);

  const [formData, setFormData] = useState({
    status: 'Active',
    brand: '',
    line: '',
    code: '',
    description: '',
    quantityPerBox: '',
    unit: '',
    ean: '',
    dun14: '',
    taxClassification: '',
    ncm: '',
    cest: '',
    unitNetWeightKg: '',
    boxWeightKg: '',
    st: '',
    factoryId: '',
    catalogProductId: '',
    customSurchargeValue: '0',
    customSurchargeType: 'fixed'
  });

  const [hasPopulated, setHasPopulated] = useState(false);

  useEffect(() => {
    if (product && !hasPopulated) {
      setFormData({
        status: product.status || 'Active',
        brand: product.brand || '',
        line: product.line || '',
        code: product.code || '',
        description: product.description || '',
        quantityPerBox: product.quantityPerBox !== undefined ? String(product.quantityPerBox) : '',
        unit: product.unit || '',
        ean: product.ean || '',
        dun14: product.dun14 || '',
        taxClassification: product.taxClassification || '',
        ncm: product.ncm || '',
        cest: product.cest || '',
        unitNetWeightKg: product.unitNetWeightKg !== undefined ? String(product.unitNetWeightKg) : '',
        boxWeightKg: product.boxWeightKg !== undefined ? String(product.boxWeightKg) : '',
        st: product.st || '',
        factoryId: product.factoryId || '',
        catalogProductId: product.catalogProductId || '',
        customSurchargeValue: product.customSurchargeValue !== undefined ? String(product.customSurchargeValue) : '0',
        customSurchargeType: product.customSurchargeType || 'fixed'
      });
      setHasPopulated(true);
    }
  }, [product, hasPopulated]);

  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null
  , [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  const catalogQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices'), orderBy('name')) : null
  , [db, orgId]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  const filteredCatalog = useMemo(() => {
    if (!formData.factoryId) return [];
    return catalogProducts?.filter(p => p.factoryId === formData.factoryId) || [];
  }, [formData.factoryId, catalogProducts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productRef || !orgId) return;
    
    updateDocumentNonBlocking(productRef, {
      ...formData,
      organizationId: orgId,
      quantityPerBox: Number(formData.quantityPerBox) || 0,
      unitNetWeightKg: Number(formData.unitNetWeightKg) || 0,
      boxWeightKg: Number(formData.boxWeightKg) || 0,
      customSurchargeValue: Number(formData.customSurchargeValue) || 0,
      updatedAt: serverTimestamp()
    });

    toast({ title: "Produto atualizado" });
    router.push('/admin/products');
  };

  if (isProductLoading || !orgId) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/admin/products" className="text-muted-foreground hover:text-primary">
          <ChevronLeft size={28} />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Editar Produto</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Ativo</SelectItem>
                        <SelectItem value="Inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Linha</Label>
                    <Input value={formData.line} onChange={(e) => setFormData({...formData, line: e.target.value})} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-primary" /> Aditivo de Margem (Oculto)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={formData.customSurchargeType} onValueChange={(val) => setFormData({...formData, customSurchargeType: val})}>
                  <TabsList className="grid w-full grid-cols-2 h-10">
                    <TabsTrigger value="fixed" className="text-xs">Fixo (R$)</TabsTrigger>
                    <TabsTrigger value="percentage" className="text-xs">Percentual (%)</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-primary">
                    {formData.customSurchargeType === 'fixed' ? 'R$' : '%'}
                  </span>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.customSurchargeValue} 
                    onChange={(e) => setFormData({...formData, customSurchargeValue: e.target.value})} 
                    className="pl-10 h-12 text-lg font-bold"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-lg border-accent/20">
              <CardHeader className="bg-accent/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag size={18} className="text-accent" /> Amarração de Preço
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Fábrica de Origem</Label>
                  <Select value={formData.factoryId} onValueChange={(val) => setFormData({...formData, factoryId: val, catalogProductId: ''})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Item do Catálogo (Preço Bruto)</Label>
                  <Select value={formData.catalogProductId} onValueChange={(val) => setFormData({...formData, catalogProductId: val})} disabled={!formData.factoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o item..." /></SelectTrigger>
                    <SelectContent>
                      {filteredCatalog.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <Button type="submit" className="w-full h-12 font-bold text-lg gap-2">
                  <Save size={20} /> Salvar Alterações
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
