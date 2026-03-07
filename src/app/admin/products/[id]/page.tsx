
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
import { Save, ChevronLeft, Tag, Loader2, Package, Calculator, Barcode, AlertCircle } from "lucide-react";
import Link from 'next/link';

export default function EditRegisteredProductPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // OBRIGATÓRIO: Buscar perfil pelo e-mail para suporte Multi-usuário (SaaS)
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  // Referência do produto vinculada à organização (Amarrado ao Usuário)
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
    quantityPerBox: '0',
    unit: '',
    ean: '',
    dun14: '',
    taxClassification: '',
    ncm: '',
    cest: '',
    unitNetWeightKg: '0',
    boxWeightKg: '0',
    st: '0%',
    factoryId: 'none',
    catalogProductId: 'none',
    customSurchargeValue: '0',
    customSurchargeType: 'fixed'
  });

  // SINCRONIZAÇÃO DA FICHA: Carrega os dados assim que o banco responde
  useEffect(() => {
    if (product) {
      setFormData({
        status: product.status || 'Active',
        brand: String(product.brand || '').toUpperCase(),
        line: String(product.line || '').toUpperCase(),
        code: String(product.code || ''),
        description: String(product.description || '').toUpperCase(),
        quantityPerBox: String(product.quantityPerBox ?? '0'),
        unit: String(product.unit || '').toUpperCase(),
        ean: String(product.ean || ''),
        dun14: String(product.dun14 || ''),
        taxClassification: String(product.taxClassification || ''),
        ncm: String(product.ncm || ''),
        cest: String(product.cest || ''),
        unitNetWeightKg: String(product.unitNetWeightKg ?? '0'),
        boxWeightKg: String(product.boxWeightKg ?? '0'),
        st: String(product.st || '0%'),
        factoryId: product.factoryId || 'none',
        catalogProductId: product.catalogProductId || 'none',
        customSurchargeValue: String(product.customSurchargeValue ?? '0'),
        customSurchargeType: String(product.customSurchargeType || 'fixed')
      });
    }
  }, [product]);

  // Listas auxiliares para vínculo de preço (Catálogo da Organização)
  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null
  , [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  const catalogQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices'), orderBy('name')) : null
  , [db, orgId]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  const filteredCatalog = useMemo(() => {
    if (!formData.factoryId || formData.factoryId === 'none') return [];
    return catalogProducts?.filter(p => p.factoryId === formData.factoryId) || [];
  }, [formData.factoryId, catalogProducts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productRef || !orgId) return;
    
    updateDocumentNonBlocking(productRef, {
      ...formData,
      organizationId: orgId,
      factoryId: formData.factoryId === 'none' ? '' : formData.factoryId,
      catalogProductId: formData.catalogProductId === 'none' ? '' : formData.catalogProductId,
      quantityPerBox: Number(formData.quantityPerBox) || 0,
      unitNetWeightKg: Number(formData.unitNetWeightKg) || 0,
      boxWeightKg: Number(formData.boxWeightKg) || 0,
      customSurchargeValue: Number(formData.customSurchargeValue) || 0,
      updatedAt: serverTimestamp()
    });

    toast({ title: "Ficha técnica salva!", description: "Dados sincronizados com sucesso." });
    router.push('/admin/products');
  };

  if (isProfileLoading || isProductLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px]">Identificando Organização e Carregando Ficha...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertCircle size={64} className="mx-auto text-destructive opacity-20 mb-4" />
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Acesso Não Vinculado</h2>
        <p className="text-muted-foreground mt-2">Seu e-mail ({user?.email}) não possui organização ativa.</p>
        <Link href="/"><Button variant="outline" className="mt-6">Voltar</Button></Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertCircle size={64} className="mx-auto text-destructive opacity-20 mb-4" />
        <h2 className="text-2xl font-bold uppercase tracking-tighter">Item Inexistente</h2>
        <p className="text-muted-foreground mt-2">O produto solicitado não foi encontrado na base da empresa {orgId}.</p>
        <Link href="/admin/products"><Button variant="outline" className="mt-6">Voltar para a Lista</Button></Link>
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
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Editar Ficha Técnica</h1>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Organização: {orgId} | Usuário: {user?.email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="shadow-lg border-none">
              <CardHeader className="bg-primary/5 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <Package size={18} className="text-primary" /> Identificação do Produto
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Ativo</SelectItem>
                        <SelectItem value="Inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Código Interno</Label>
                    <Input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="h-11 font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Descrição Completa</Label>
                  <Input required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value.toUpperCase()})} className="h-11 uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Marca</Label>
                    <Input required value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value.toUpperCase()})} className="h-11 font-semibold uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Linha</Label>
                    <Input required value={formData.line} onChange={(e) => setFormData({...formData, line: e.target.value.toUpperCase()})} className="h-11 uppercase" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-emerald-50 py-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-emerald-700">
                  <Calculator size={18} /> Logística e Pesos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Unidade</Label>
                    <Input placeholder="ex: PC" required value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value.toUpperCase()})} className="h-11 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Qtd/Caixa</Label>
                    <Input type="number" required value={formData.quantityPerBox} onChange={(e) => setFormData({...formData, quantityPerBox: e.target.value})} className="h-11 font-bold text-center" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">ST (%)</Label>
                    <Input placeholder="0%" value={formData.st} onChange={(e) => setFormData({...formData, st: e.target.value})} className="h-11 font-bold text-destructive" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Peso Líq. Unit (Kg)</Label>
                    <Input type="number" step="0.001" required value={formData.unitNetWeightKg} onChange={(e) => setFormData({...formData, unitNetWeightKg: e.target.value})} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Peso Caixa (Kg)</Label>
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
                <CardDescription className="text-[9px] font-bold uppercase">Configure de qual item do catálogo este produto puxará o preço.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Fábrica de Origem</Label>
                  <Select value={formData.factoryId} onValueChange={(val) => setFormData({...formData, factoryId: val, catalogProductId: 'none'})}>
                    <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Selecione a Fábrica..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione a Fábrica...</SelectItem>
                      {factories?.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Item do Catálogo (Preço)</Label>
                  <Select value={formData.catalogProductId} onValueChange={(val) => setFormData({...formData, catalogProductId: val})} disabled={formData.factoryId === 'none'}>
                    <SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Escolha o item..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione o Item...</SelectItem>
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
                    <Label className="text-[10px] font-black uppercase">EAN (GTIN)</Label>
                    <Input value={formData.ean} onChange={(e) => setFormData({...formData, ean: e.target.value})} className="h-11 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">DUN-14</Label>
                    <Input value={formData.dun14} onChange={(e) => setFormData({...formData, dun14: e.target.value})} className="h-11 font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">NCM</Label>
                    <Input value={formData.ncm} onChange={(e) => setFormData({...formData, ncm: e.target.value})} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">CEST</Label>
                    <Input value={formData.cest} onChange={(e) => setFormData({...formData, cest: e.target.value})} className="h-11" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-6 border-t bg-slate-50">
                <Button type="submit" className="w-full h-14 font-black text-lg gap-2 shadow-lg">
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
