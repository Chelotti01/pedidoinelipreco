
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, Tag, Loader2, DollarSign, Percent, Package, Calculator, ShieldCheck, Barcode } from "lucide-react";
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditRegisteredProductPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Busca perfil pelo e-mail
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

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

    toast({ title: "Produto atualizado com sucesso!" });
    router.push('/admin/products');
  };

  if (isProductLoading || !orgId) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-muted-foreground font-bold animate-pulse uppercase tracking-widest text-[10px]">Carregando Ficha Técnica...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Ficha Técnica do Produto</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase">Editando ID: {id?.slice(-6).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {/* INFORMAÇÕES BÁSICAS */}
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-primary/5 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Package size={18} className="text-primary" /> Dados Principais
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Ativo</SelectItem>
                        <SelectItem value="Inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Código Interno</Label>
                    <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="h-11 font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Descrição Completa</Label>
                  <Input required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="h-11 uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Marca</Label>
                    <Input value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} className="h-11 font-semibold uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Linha</Label>
                    <Input value={formData.line} onChange={(e) => setFormData({...formData, line: e.target.value})} className="h-11 uppercase" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LOGÍSTICA E PESOS */}
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-accent/5 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-accent">
                  <Calculator size={18} /> Logística e Pesos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Unidade</Label>
                    <Input placeholder="ex: PC" required value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="h-11 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Qtd/Caixa</Label>
                    <Input type="number" required value={formData.quantityPerBox} onChange={(e) => setFormData({...formData, quantityPerBox: e.target.value})} className="h-11 font-bold text-center" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">ST (%)</Label>
                    <Input placeholder="0%" value={formData.st} onChange={(e) => setFormData({...formData, st: e.target.value})} className="h-11 font-bold text-destructive" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Peso Líq. Unit (Kg)</Label>
                    <Input type="number" step="0.001" required value={formData.unitNetWeightKg} onChange={(e) => setFormData({...formData, unitNetWeightKg: e.target.value})} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Peso Caixa (Kg)</Label>
                    <Input type="number" step="0.001" required value={formData.boxWeightKg} onChange={(e) => setFormData({...formData, boxWeightKg: e.target.value})} className="h-11" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MARGEM OCULTA */}
            <Card className="shadow-lg bg-primary/5 border-primary/20">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                  <DollarSign size={18} /> Aditivo de Margem (Oculto)
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Valor somado ao preço unitário sem sinalização.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={formData.customSurchargeType} onValueChange={(val) => setFormData({...formData, customSurchargeType: val})}>
                  <TabsList className="grid w-full grid-cols-2 h-10">
                    <TabsTrigger value="fixed" className="text-[10px] font-black uppercase">Fixo (R$)</TabsTrigger>
                    <TabsTrigger value="percentage" className="text-[10px] font-black uppercase">Percentual (%)</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-primary text-lg">
                    {formData.customSurchargeType === 'fixed' ? 'R$' : '%'}
                  </span>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.customSurchargeValue} 
                    onChange={(e) => setFormData({...formData, customSurchargeValue: e.target.value})} 
                    className="pl-12 h-14 text-2xl font-black text-primary border-primary/30"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* AMARRAÇÃO DE PREÇO */}
            <Card className="shadow-lg border-primary/30 bg-primary/5">
              <CardHeader className="bg-primary/10 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Tag size={18} className="text-primary" /> Amarração de Preço
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">O preço bruto será puxado deste item importado.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Fábrica de Origem</Label>
                  <Select value={formData.factoryId} onValueChange={(val) => setFormData({...formData, factoryId: val, catalogProductId: ''})}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Item do Catálogo (Preço Bruto)</Label>
                  <Select value={formData.catalogProductId} onValueChange={(val) => setFormData({...formData, catalogProductId: val})} disabled={!formData.factoryId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o item..." /></SelectTrigger>
                    <SelectContent>
                      {filteredCatalog.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* DADOS FISCAIS */}
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-slate-100 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Barcode size={18} className="text-slate-600" /> Dados Fiscais / EAN
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">EAN (GTIN)</Label>
                  <Input value={formData.ean} onChange={(e) => setFormData({...formData, ean: e.target.value})} className="h-11 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">DUN-14</Label>
                  <Input value={formData.dun14} onChange={(e) => setFormData({...formData, dun14: e.target.value})} className="h-11 font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">NCM</Label>
                    <Input value={formData.ncm} onChange={(e) => setFormData({...formData, ncm: e.target.value})} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">CEST</Label>
                    <Input value={formData.cest} onChange={(e) => setFormData({...formData, cest: e.target.value})} className="h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Classificação Fiscal</Label>
                  <Input value={formData.taxClassification} onChange={(e) => setFormData({...formData, taxClassification: e.target.value})} className="h-11" />
                </div>
              </CardContent>
              <CardFooter className="pt-6 border-t bg-slate-50">
                <Button type="submit" className="w-full h-14 font-black text-lg gap-2 shadow-lg hover:bg-primary/90">
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
