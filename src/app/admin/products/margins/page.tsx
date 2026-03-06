
"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, DollarSign, Percent, Search, Loader2, Save, FilterX } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function MarginsManagementPage() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");

  const productsQuery = useMemoFirebase(() => query(collection(db, 'registered_products'), orderBy('description')), [db]);
  const { data: products, isLoading } = useCollection(productsQuery);

  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories } = useCollection(factoriesQuery);

  const uniqueBrands = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort();
  }, [products]);

  const uniqueLines = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map(p => p.line).filter(Boolean))).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || p.description?.toLowerCase().includes(term) || p.code?.toLowerCase().includes(term);
      const matchesFactory = factoryFilter === "all" || p.factoryId === factoryFilter;
      const matchesBrand = brandFilter === "all" || p.brand === brandFilter;
      const matchesLine = lineFilter === "all" || p.line === lineFilter;
      return matchesSearch && matchesFactory && matchesBrand && matchesLine;
    });
  }, [products, searchTerm, factoryFilter, brandFilter, lineFilter]);

  const resetFilters = () => {
    setSearchTerm("");
    setFactoryFilter("all");
    setBrandFilter("all");
    setLineFilter("all");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Gestão de Margens</h1>
            <p className="text-muted-foreground">Ajuste o aditivo oculto de todos os produtos cadastrados.</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="mb-8 border-none shadow-sm bg-muted/30">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="Pesquisar..." 
                className="pl-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={factoryFilter} onValueChange={setFactoryFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Fábrica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Fábricas</SelectItem>
                {factories?.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Marcas</SelectItem>
                {uniqueBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={lineFilter} onValueChange={setLineFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Linha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Linhas</SelectItem>
                {uniqueLines.map(line => (
                  <SelectItem key={line} value={line}>{line}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground gap-2">
              <FilterX size={16} /> Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center flex-col gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-muted-foreground animate-pulse">Carregando produtos...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm">
          <DollarSign className="mx-auto mb-4 opacity-10" size={64} />
          <p className="text-muted-foreground font-medium">Nenhum produto encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProducts.map((p) => (
            <MarginSurchargeCard key={p.id} product={p} db={db} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarginSurchargeCard({ product, db }: { product: any, db: any }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [surchargeValue, setSurchargeValue] = useState(product.customSurchargeValue !== undefined ? String(product.customSurchargeValue) : (product.customSurchargeR$ !== undefined ? String(product.customSurchargeR$) : '0'));
  const [surchargeType, setSurchargeType] = useState(product.customSurchargeType || 'fixed');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateDocumentNonBlocking(doc(db, 'registered_products', product.id), {
        customSurchargeValue: Number(surchargeValue) || 0,
        customSurchargeType: surchargeType,
        // Retrocompatibilidade
        customSurchargeR$: surchargeType === 'fixed' ? Number(surchargeValue) : 0,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Margem atualizada", description: `${product.code} salvo com sucesso.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-lg border-none hover:shadow-xl transition-shadow">
      <CardHeader className="bg-slate-50/50 pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
               {product.code}
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase truncate max-w-[200px]">
              {product.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 text-slate-600`}>
              {product.brand}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <DollarSign size={20} className="shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Aditivo de Margem (Oculto)</span>
              <span className="text-[10px] text-muted-foreground">Valor somado ao preço unitário sem sinalização externa.</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">TIPO DE ADITIVO</Label>
            <Tabs 
              value={surchargeType} 
              onValueChange={(val) => setSurchargeType(val)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 h-11 bg-slate-100 p-1">
                <TabsTrigger value="fixed" className="gap-2 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <DollarSign size={14} /> Fixo (R$)
                </TabsTrigger>
                <TabsTrigger value="percentage" className="gap-2 text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Percent size={14} /> Percentual (%)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-bold">{surchargeType === 'fixed' ? 'Valor Fixo (R$)' : 'Porcentagem (%)'}</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black text-lg">
                {surchargeType === 'fixed' ? 'R$' : '%'}
              </div>
              <Input 
                type="number" 
                step="0.01" 
                value={surchargeValue} 
                onChange={(e) => setSurchargeValue(e.target.value)} 
                onFocus={(e) => e.target.select()}
                className="h-14 text-2xl font-black text-primary pl-12 bg-slate-50/30 border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic font-medium">
              {surchargeType === 'fixed' 
                ? "Este valor será somado diretamente ao preço unitário." 
                : "Esta porcentagem será aplicada sobre o preço líquido do item."}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 pb-6 px-6">
        <Button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="w-full h-12 gap-2 font-bold shadow-md hover:shadow-lg transition-all"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
          Salvar Margem
        </Button>
      </CardFooter>
    </Card>
  );
}
