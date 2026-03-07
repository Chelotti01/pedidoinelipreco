
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
import { Save, ChevronLeft, Tag, Loader2, DollarSign, Package, Calculator, Barcode, AlertCircle } from "lucide-react";
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditRegisteredProductPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Busca perfil pelo e-mail para garantir o orgId correto
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  // Referência do produto no Firestore
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

  // Efeito para preencher o formulário assim que o produto for carregado
  useEffect(() => {
    if (product) {
      setFormData({
        status: product.status || 'Active',
        brand: product.brand || '',
        line: product.line || '',
        code: product.code || '',
        description: product.description || '',
        quantityPerBox: product.quantityPerBox !== undefined ? String(product.quantityPerBox) : '0',
        unit: product.unit || '',
        ean: product.ean || '',
        dun14: product.dun14 || '',
        taxClassification: product.taxClassification || '',
        ncm: product.ncm || '',
        cest: product.cest || '',
        unitNetWeightKg: product.unitNetWeightKg !== undefined ? String(product.unitNetWeightKg) : '0',
        boxWeightKg: product.boxWeightKg !== undefined ? String(product.boxWeightKg) : '0',
        st: product.st || '0%',
        factoryId: product.factoryId || '',
        catalogProductId: product.catalogProductId || '',
        customSurchargeValue: product.customSurchargeValue !== undefined ? String(product.customSurchargeValue) : '0',
        customSurchargeType: product.customSurchargeType || 'fixed'
      });
    }
  }, [product]);

  // Carrega fábricas para o seletor de "Amarração"
  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null
  , [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  // Carrega catálogo de preços importados
  const catalogQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices'), orderBy('name')) : null
  , [db, orgId]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  // Filtra o catálogo pela fábrica selecionada
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

    toast({ title: "Ficha técnica atualizada!" });
    router.push('/admin/products');
  };

  if (isProductLoading || !orgId) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-muted-foreground font-bold animate-pulse uppercase tracking-widest text-[10px]">Sincronizando Ficha Técnica...</p>
      </div>
    );
  }

  if (!product && !isProductLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle size={64} className="mx-auto text-destructive opacity-20" />
        <h2 className="text-2xl font-bold">Produto não encontrado</h2>
        <Link href="/admin/products"><Button variant="outline">Voltar para a Lista</Button></Link>
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
            <p className="text-muted-foreground text-xs font-bold uppercase">Empresa: {orgId} | Cód: {formData.code}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
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
          </div>

          <div className="space-y-6">
            <Card className="shadow-lg border-primary/30 bg-primary/5">
              <CardHeader className="bg-primary/10 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Tag size={18} className="text-primary" /> Amarração de Preço
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Vincule este cadastro técnico a um item do catálogo de preços.</CardDescription>
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

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-slate-100 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Barcode size={18} className="text-slate-600" /> Códigos e Impostos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">EAN (GTIN)</Label>
                    <Input value={formData.ean} onChange={(e) => setFormData({...formData, ean: e.target.value})} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">DUN-14</Label>
                    <Input value={formData.dun14} onChange={(e) => setFormData({...formData, dun14: e.target.value})} className="h-11 font-mono" />
                  </div>
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
              </CardContent>
              <CardFooter className="pt-6 border-t bg-slate-50">
                <Button type="submit" className="w-full h-14 font-black text-lg gap-2 shadow-lg hover:bg-primary/90">
                  <Save size={20} /> Salvar Ficha Técnica
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
