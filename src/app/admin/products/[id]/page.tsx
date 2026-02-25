
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, Search, Tag, Loader2, AlertCircle, Copy } from "lucide-react";
import Link from 'next/link';

export default function EditRegisteredProductPage() {
  const db = useFirestore();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const productRef = useMemoFirebase(() => id ? doc(db, 'registered_products', id) : null, [db, id]);
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
    catalogProductId: ''
  });

  const [hasPopulated, setHasPopulated] = useState(false);

  // Popula o formulário assim que o produto é carregado com sucesso
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
        catalogProductId: product.catalogProductId || ''
      });
      setHasPopulated(true);
    }
  }, [product, hasPopulated]);

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
    if (!productRef || !hasPopulated) {
      toast({ title: "Erro ao salvar", description: "Os dados originais ainda não foram carregados.", variant: "destructive" });
      return;
    }
    
    if (!formData.code || !formData.description) {
      toast({ title: "Erro ao salvar", description: "Código e Descrição são campos obrigatórios.", variant: "destructive" });
      return;
    }

    updateDocumentNonBlocking(productRef, {
      ...formData,
      quantityPerBox: Number(formData.quantityPerBox) || 0,
      unitNetWeightKg: Number(formData.unitNetWeightKg) || 0,
      boxWeightKg: Number(formData.boxWeightKg) || 0,
      updatedAt: serverTimestamp()
    });

    toast({ title: "Produto atualizado", description: "As alterações foram salvas com sucesso." });
    router.push('/admin/products');
  };

  const handleDuplicate = () => {
    if (!hasPopulated) return;

    addDocumentNonBlocking(collection(db, 'registered_products'), {
      ...formData,
      code: `${formData.code}-cópia`,
      quantityPerBox: Number(formData.quantityPerBox) || 0,
      unitNetWeightKg: Number(formData.unitNetWeightKg) || 0,
      boxWeightKg: Number(formData.boxWeightKg) || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    toast({ title: "Produto duplicado", description: "Uma nova cópia foi criada. Redirecionando para a lista..." });
    router.push('/admin/products');
  };

  if (isProductLoading || (id && !hasPopulated)) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <div className="text-center">
          <p className="text-muted-foreground font-medium animate-pulse">Buscando dados no banco de dados...</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Sincronizando ficha técnica...</p>
        </div>
      </div>
    );
  }

  if (!isProductLoading && !product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 text-destructive" size={48} />
        <h2 className="text-2xl font-bold mb-2">Produto não encontrado</h2>
        <p className="text-muted-foreground mb-6">O produto solicitado não existe ou foi removido.</p>
        <Link href="/admin/products">
          <Button>Voltar para Lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Editar Produto</h1>
        </div>
        <Button variant="outline" type="button" onClick={handleDuplicate} className="gap-2 border-primary text-primary hover:bg-primary/5">
          <Copy size={18} /> Duplicar Produto
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="shadow-lg border-none">
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
                    <Input value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Linha</Label>
                    <Input value={formData.line} onChange={(e) => setFormData({...formData, line: e.target.value})} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
              <CardHeader className="bg-accent/5">
                <CardTitle className="text-lg">Logística e Pesos</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Input placeholder="ex: PC" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Qtd/Caixa</Label>
                    <Input type="number" value={formData.quantityPerBox} onChange={(e) => setFormData({...formData, quantityPerBox: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>ST</Label>
                    <Input placeholder="ex: 0%" value={formData.st} onChange={(e) => setFormData({...formData, st: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Peso Líq. Unit (Kg)</Label>
                    <Input type="number" step="0.001" value={formData.unitNetWeightKg} onChange={(e) => setFormData({...formData, unitNetWeightKg: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso Caixa (Kg)</Label>
                    <Input type="number" step="0.001" value={formData.boxWeightKg} onChange={(e) => setFormData({...formData, boxWeightKg: e.target.value})} />
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
                  <div className="p-3 bg-muted rounded-md text-xs space-y-1 border-l-4 border-primary">
                    <p className="font-bold text-primary flex items-center gap-1"><Search size={12}/> Item vinculado com sucesso</p>
                    <p>O preço deste cadastro mudará automaticamente quando uma nova planilha da fábrica for enviada.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
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
                <Button type="submit" className="w-full gap-2 h-12 text-lg font-bold shadow-lg">
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
