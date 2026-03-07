
"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, DollarSign, Percent, Search, Loader2, Save, FilterX, Tag } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function MarginsManagementPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  // Get user profile for organizationId via Email (SaaS Pattern)
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const [searchTerm, setSearchTerm] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");

  const productsQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'products'), orderBy('description')) : null
  , [db, orgId]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories'), orderBy('name')) : null
  , [db, orgId]);
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

  const isLoading = isProfileLoading || isProductsLoading;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Gestão de Margens</h1>
            <p className="text-muted-foreground">Ajuste o aditivo oculto dos produtos ({orgId || 'Carregando...'}).</p>
          </div>
        </div>
      </div>

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
        <div className="space-y-3">
          {filteredProducts.map((p) => (
            <MarginSurchargeRow key={p.id} product={p} db={db} orgId={orgId!} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarginSurchargeRow({ product, db, orgId }: { product: any, db: any, orgId: string }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [surchargeValue, setSurchargeValue] = useState(product.customSurchargeValue !== undefined ? String(product.customSurchargeValue) : '0');
  const [surchargeType, setSurchargeType] = useState(product.customSurchargeType || 'fixed');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateDocumentNonBlocking(doc(db, 'organizations', orgId, 'products', product.id), {
        customSurchargeValue: Number(surchargeValue) || 0,
        customSurchargeType: surchargeType,
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
    <Card className="shadow-sm border-none hover:shadow-md transition-shadow bg-white overflow-hidden">
      <CardContent className="p-4 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1 min-w-0 w-full md:w-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-black text-slate-800 uppercase tracking-tighter">{product.code}</span>
            <div className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-black uppercase">
              {product.brand}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase truncate max-w-md">
            {product.description}
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            Linha: {product.line || 'N/A'}
          </div>
        </div>

        <div className="w-full md:w-auto shrink-0">
          <Tabs 
            value={surchargeType} 
            onValueChange={(val) => setSurchargeType(val)}
            className="w-full md:w-56"
          >
            <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100 p-1">
              <TabsTrigger value="fixed" className="gap-2 text-[10px] font-black data-[state=active]:bg-white">
                <DollarSign size={12} /> FIXO (R$)
              </TabsTrigger>
              <TabsTrigger value="percentage" className="gap-2 text-[10px] font-black data-[state=active]:bg-white">
                <Percent size={12} /> PERC. (%)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-32">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary font-black text-xs">
              {surchargeType === 'fixed' ? 'R$' : '%'}
            </div>
            <Input 
              type="number" 
              step="0.01" 
              value={surchargeValue} 
              onChange={(e) => setSurchargeValue(e.target.value)} 
              onFocus={(e) => e.target.select()}
              className="h-9 text-right font-black text-primary pl-8 pr-2 bg-slate-50 border-slate-200"
            />
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            size="sm"
            className="h-9 px-4 gap-2 font-black shadow-sm"
          >
            {isSaving ? <Loader2 className="animate-spin size-4" /> : <Save size={16} />}
            SALVAR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
