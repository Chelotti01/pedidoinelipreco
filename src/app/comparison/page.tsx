
"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ChevronLeft, Diff, Loader2, Factory, DollarSign, Percent, Search } from "lucide-react";
import Link from 'next/link';

export default function ComparisonPage() {
  const db = useFirestore();
  const { user } = useUser();
  
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const [searchTerm, setSearchTerm] = useState("");
  const [contractPercent, setContractPercent] = useState<number>(0);
  const [priceType, setExportPriceType] = useState<'closed' | 'fractional'>('closed');

  const productsQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'products'), orderBy('code')) : null
  , [db, orgId]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const catalogQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'productFactoryPrices')) : null
  , [db, orgId]);
  const { data: catalogProducts, isLoading: isCatalogLoading } = useCollection(catalogQuery);

  const factoriesQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'factories')) : null
  , [db, orgId]);
  const { data: factories } = useCollection(factoriesQuery);

  const comparisonGroups = useMemo(() => {
    if (!products || !catalogProducts) return [];

    // Agrupar produtos pelo código
    const groups: Record<string, any[]> = {};
    products.forEach(p => {
      const code = String(p.code || "").trim();
      if (!code) return;
      if (!groups[code]) groups[code] = [];
      groups[code].push(p);
    });

    // Filtrar grupos que aparecem em mais de uma fábrica
    return Object.entries(groups)
      .filter(([_, items]) => {
        const uniqueFactories = new Set(items.map(i => i.factoryId));
        return uniqueFactories.size > 1;
      })
      .map(([code, items]) => {
        const processedItems = items.map(p => {
          const catalogItem = catalogProducts.find(cp => cp.id === p.catalogProductId);
          const factoryName = factories?.find(f => f.id === p.factoryId)?.name || 'Fábrica';
          
          if (!catalogItem) return { ...p, factoryName, error: true };

          const basePrice = priceType === 'closed' ? (catalogItem.closedLoadPrice || 0) : (catalogItem.fractionalLoadPrice || 0);
          const afterCatalog = Math.max(0, basePrice - (catalogItem.discountAmount || 0));
          const surchargeValue = p.customSurchargeValue !== undefined ? Number(p.customSurchargeValue) : (p.customSurchargeR$ || 0);
          const surchargeType = p.customSurchargeType || 'fixed';
          
          let withSurcharge = afterCatalog;
          if (surchargeType === 'percentage') withSurcharge += afterCatalog * (surchargeValue / 100);
          else withSurcharge += surchargeValue;

          const netPrice = withSurcharge * (1 + contractPercent / 100);
          const stRate = p.st ? parseFloat(p.st.replace('%', '').replace(',', '.')) / 100 : 0;
          const finalPrice = netPrice * (1 + stRate);

          return {
            ...p,
            factoryName,
            netPrice,
            finalPrice,
            description: p.description
          };
        });

        return {
          code,
          description: processedItems[0].description,
          items: processedItems
        };
      })
      .filter(group => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return group.code.toLowerCase().includes(term) || group.description?.toLowerCase().includes(term);
      });
  }, [products, catalogProducts, factories, priceType, contractPercent, searchTerm]);

  const isLoading = isProfileLoading || isProductsLoading || isCatalogLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Comparação de Fábricas</h1>
            <p className="text-muted-foreground">Analise códigos duplicados entre diferentes origens ({orgId}).</p>
          </div>
        </div>
      </div>

      <Card className="mb-8 border-none shadow-sm bg-muted/30">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                <Search size={12} /> Pesquisar Produto
              </Label>
              <Input 
                placeholder="Código ou descrição..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                <Factory size={12} /> Tipo de Carga
              </Label>
              <Select value={priceType} onValueChange={(v: any) => setExportPriceType(v)}>
                <SelectTrigger className="bg-white h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Carga Fechada</SelectItem>
                  <SelectItem value="fractional">Carga Fracionada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                <Percent size={12} /> Aditivo de Contrato (%)
              </Label>
              <Input 
                type="number" 
                value={contractPercent} 
                onChange={(e) => setContractPercent(Number(e.target.value))} 
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {comparisonGroups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border-2 border-dashed">
          <Diff className="mx-auto mb-4 opacity-10" size={64} />
          <p className="text-muted-foreground font-medium">Nenhum código repetido em diferentes fábricas foi encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comparisonGroups.map((group) => (
            <Card key={group.code} className="overflow-hidden border-none shadow-lg">
              <CardHeader className="bg-primary/5 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-primary">COD: {group.code}</span>
                    <Badge variant="outline" className="font-bold uppercase text-[10px]">{group.description}</Badge>
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase">{group.items.length} FÁBRICAS</span>
                </div>
              </CardHeader>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase">Fábrica de Origem</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase">Unitário NET</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase text-primary">Unitário FINAL (+ST)</TableHead>
                    <TableHead className="text-center font-black text-[10px] uppercase">ST (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          <span className="font-bold text-slate-700">{item.factoryName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-600">
                        {item.netPrice?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-right font-black text-primary text-lg">
                        {item.finalPrice?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono">{item.st || '0%'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
