"use client"

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, Search, Tag, DollarSign } from "lucide-react";
import Link from 'next/link';

export default function NewRegisteredProductPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

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
    customSurchargeR$: '0'
  });

  // Fetch factories and products for binding
  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories } = useCollection(factoriesQuery);

  const catalogQuery = useMemoFirebase(() => query(collection(db, 'catalog_products'), orderBy('name')), [db]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  const filteredCatalog = useMemo(() => {
    if (!formData.factoryId) return [];
    return catalogProducts?.filter(p => p.factoryId === formData.factoryId) || [];
  }, [formData.factoryId, catalogProducts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.catalogProductId) {
      toast({ title: "Vínculo obrigatório", description: "Selecione um produto do catálogo para vincular o preço.", variant: "destructive" });
      return;
    }

    addDocumentNonBlocking(collection(db, 'registered_products'), {
      ...formData,
      quantityPerBox: Number(formData.quantityPerBox),
      unitNetWeightKg: Number(formData.unitNetWeightKg),
      boxWeightKg: Number(formData.boxWeightKg),
      customSurchargeR$: Number(formData.customSurchargeR$) || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    toast({ title: "Produto cadastrado", description: "O produto paralelo foi registrado com sucesso." });
    router.push('/admin/products');
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Novo Produto Paralelo</h1>
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
                <CardDescription>Valor em Reais somado ao preço unitário sem sinalização externa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Aditivo Unitário (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.customSurchargeR$} 
                    onChange={(e) => setFormData({...formData, customSurchargeR$: e.target.value})} 
                    className="h-12 text-lg font-bold text-primary"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-accent/5">
                <CardTitle className="text-lg">Logística e Pesos</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Input placeholder="ex: PC" required value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Qtd/Caixa</Label>
                    <Input type="number" required value={formData.quantityPerBox} onChange={(e) => setFormData({...formData, quantityPerBox: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>ST</Label>
                    <Input placeholder="ex: 0%" value={formData.st} onChange={(e) => setFormData({...formData, st: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Peso Líq. Unit (Kg)</Label>
                    <Input type="number" step="0.001" required value={formData.unitNetWeightKg} onChange={(e) => setFormData({...formData, unitNetWeightKg: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso Caixa (Kg)</Label>
                    <Input type="number" step="0.001" required value={formData.boxWeightKg} onChange={(e) => setFormData({...formData, boxWeightKg: e.target.value})} />
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
                <CardDescription>O preço será puxado dinamicamente do item selecionado.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Selecionar Fábrica</Label>
                  <Select value={formData.factoryId} onValueChange={(val) => setFormData({...formData, factoryId: val, catalogProductId: ''})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a fábrica para filtrar" />
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
                      <SelectValue placeholder={formData.factoryId ? "Selecione o produto" : "Selecione uma fábrica primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCatalog.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.catalogProductId && (
                  <div className="p-3 bg-muted rounded-md text-xs space-y-1">
                    <p className="font-bold text-primary flex items-center gap-1"><Search size={12} /> Item vinculado com sucesso</p>
                    <p>O preço deste cadastro mudará automaticamente quando uma nova planilha da fábrica for enviada.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg">Dados Fiscais / EAN</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>EAN (GTIN)</Label>
                  <Input value={formData.ean} onChange={(e) => setFormData({...formData, ean: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>DUN-14</Label>
                  <Input value={formData.dun14} onChange={(e) => setFormData({...formData, dun14: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>NCM</Label>
                    <Input value={formData.ncm} onChange={(e) => setFormData({...formData, ncm: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>CEST</Label>
                    <Input value={formData.cest} onChange={(e) => setFormData({...formData, cest: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Classificação Fiscal</Label>
                  <Input value={formData.taxClassification} onChange={(e) => setFormData({...formData, taxClassification: e.target.value})} />
                </div>
              </CardContent>
              <CardFooter className="pt-6">
                <Button type="submit" className="w-full gap-2 h-12 text-lg font-bold">
                  <Save size={20} /> Salvar Produto
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
