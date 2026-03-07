
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, Search, Tag, Loader2, AlertCircle, Copy, DollarSign, Percent } from "lucide-react";
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditRegisteredProductPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Get user profile for organizationId
  const userProfileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  // CAMINHO CORRIGIDO: organizations/{orgId}/products/{id}
  const productRef = useMemoFirebase(() => (id && orgId) ? doc(db, 'organizations', orgId, 'products', id) : null, [db, id, orgId]);
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
        customSurchargeValue: product.customSurchargeValue !== undefined ? String(product.customSurchargeValue) : (product.customSurchargeR$ !== undefined ? String(product.customSurchargeR$) : '0'),
        customSurchargeType: product.customSurchargeType || 'fixed'
      });
      setHasPopulated(true);
    }
  }, [product, hasPopulated]);

  const factoriesQuery = useMemoFirebase(() => orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null, [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  const catalogQuery = useMemoFirebase(() => orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices'), orderBy('name')) : null, [db, orgId]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  const filteredCatalog = useMemo(() => {
    if (!formData.factoryId) return [];
    return catalogProducts?.filter(p => p.factoryId === formData.factoryId) || [];
  }, [formData.factoryId, catalogProducts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productRef || !orgId || !hasPopulated) {
      toast({ title: "Erro ao salvar", description: "Os dados ainda não foram carregados.", variant: "destructive" });
      return;
    }
    
    if (!formData.code || !formData.description) {
      toast({ title: "Erro ao salvar", description: "Código e Descrição são obrigatórios.", variant: "destructive" });
      return;
    }

    updateDocumentNonBlocking(productRef, {
      ...formData,
      organizationId: orgId,
      quantityPerBox: Number(formData.quantityPerBox) || 0,
      unitNetWeightKg: Number(formData.unitNetWeightKg) || 0,
      boxWeightKg: Number(formData.boxWeightKg) || 0,
      customSurchargeValue: Number(formData.customSurchargeValue) || 0,
      customSurchargeR$: formData.customSurchargeType === 'fixed' ? Number(formData.customSurchargeValue) : 0,
      updatedAt: serverTimestamp()
    });

    toast({ title: "Produto atualizado", description: "As alterações foram salvas com sucesso." });
    router.push('/admin/products');
  };

  if (isProductLoading || !profile || (id && !hasPopulated)) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-muted-foreground font-medium animate-pulse">Buscando ficha técnica...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Editar Produto Registrado</h1>
        </div>
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
                    <Label>Código Interno</Label>
                    <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição Completa</Label>
                  <Input required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input required value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Linha</Label>
                    <Input required value={formData.line} onChange={(e) => setFormData({...formData, line: e.target.value})} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign size={18} className="text-primary" /> Aditivo de Margem (Oculto)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Tipo de Aditivo</Label>
                  <Tabs 
                    value={formData.customSurchargeType} 
                    onValueChange={(val) => setFormData({...formData, customSurchargeType: val})}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 h-11">
                      <TabsTrigger value="fixed" className="gap-2">
                        <DollarSign size={14} /> Fixo (R$)
                      </TabsTrigger>
                      <TabsTrigger value="percentage" className="gap-2">
                        <Percent size={14} /> Percentual (%)
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <div className="space-y-2">
                  <Label>{formData.customSurchargeType === 'fixed' ? 'Valor Fixo (R$)' : 'Porcentagem (%)'}</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold">
                      {formData.customSurchargeType === 'fixed' ? 'R$' : '%'}
                    </div>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.customSurchargeValue} 
                      onChange={(e) => setFormData({...formData, customSurchargeValue: e.target.value})} 
                      className="h-12 text-lg font-bold text-primary pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="bg-primary/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag size={18} className="text-primary" /> Vínculo com Catálogo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Selecionar Fábrica</Label>
                  <Select value={formData.factoryId} onValueChange={(val) => setFormData({...formData, factoryId: val, catalogProductId: ''})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a fábrica" />
                    </SelectTrigger>
                    <SelectContent>
                      {factories?.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produto do Catálogo (Preço)</Label>
                  <Select value={formData.catalogProductId} onValueChange={(val) => setFormData({...formData, catalogProductId: val})} disabled={!formData.factoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder={formData.factoryId ? "Selecione o produto" : "Selecione uma fábrica"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCatalog.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg">Dados Logísticos e Fiscais</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>EAN (GTIN)</Label>
                    <Input value={formData.ean} onChange={(e) => setFormData({...formData, ean: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>DUN-14</Label>
                    <Input value={formData.dun14} onChange={(e) => setFormData({...formData, dun14: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Input required value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Qtd/Cx</Label>
                    <Input type="number" required value={formData.quantityPerBox} onChange={(e) => setFormData({...formData, quantityPerBox: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>ST (%)</Label>
                    <Input placeholder="ex: 0%" value={formData.st} onChange={(e) => setFormData({...formData, st: e.target.value})} />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <Button type="submit" className="w-full gap-2 h-12 text-lg font-bold">
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
