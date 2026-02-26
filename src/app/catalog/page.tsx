"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search, Factory, ShoppingCart, Package, Zap, UploadCloud, Tag, Loader2, Calendar } from "lucide-react";
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CatalogPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");

  // Busca dados diretamente do Firestore
  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories, isLoading: isFactoriesLoading } = useCollection(factoriesQuery);

  const productsQuery = useMemoFirebase(() => query(collection(db, 'catalog_products'), orderBy('name')), [db]);
  const { data: catalogProducts, isLoading: isProductsLoading } = useCollection(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!catalogProducts) return [];
    
    return catalogProducts.filter(p => {
      const name = p.name || "";
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFactory = factoryFilter === "all" || p.factoryId === factoryFilter;
      return matchesSearch && matchesFactory;
    });
  }, [catalogProducts, searchTerm, factoryFilter]);

  const getFactoryName = (id: string) => {
    return factories?.find(f => f.id === id)?.name || id;
  };

  const isLoading = isFactoriesLoading || isProductsLoading;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="bg-primary p-2 rounded-lg text-white">
              <Zap size={24} />
            </div>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Catálogo de Produtos</h1>
            <p className="text-muted-foreground">Visualize itens importados sincronizados no banco de dados.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/upload">
            <Button variant="outline" className="gap-2">Importar Novos Preços</Button>
          </Link>
          <Link href="/orders/new">
            <Button className="gap-2 shadow-lg hover:shadow-primary/20"><ShoppingCart size={18} /> Novo Pedido</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="md:col-span-3">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="Pesquisar por nome do produto..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <Factory size={18} className="text-muted-foreground shrink-0" />
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as Fábricas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Fábricas</SelectItem>
                  {factories?.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-primary text-white">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium opacity-80 mb-1">Total de Itens</p>
            <p className="text-3xl font-bold">{filteredProducts.length}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary mb-4" size={48} />
          <p className="text-muted-foreground">Carregando catálogo do banco de dados...</p>
        </div>
      ) : catalogProducts?.length === 0 ? (
        <Card className="py-20 text-center">
          <CardContent>
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground">
              <Package size={40} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Banco de dados vazio</h3>
            <p className="text-muted-foreground mb-6">Você precisa importar e sincronizar uma planilha XLSX para popular o catálogo.</p>
            <Link href="/upload">
              <Button size="lg" className="gap-2"><UploadCloud size={20} /> Importar e Sincronizar</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-none shadow-xl">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow>
                <TableHead className="font-bold">Produto</TableHead>
                <TableHead className="font-bold">Fábrica</TableHead>
                <TableHead className="font-bold">Unidade</TableHead>
                <TableHead className="font-bold">Carga Fechada</TableHead>
                <TableHead className="font-bold">Carga Fracionada</TableHead>
                <TableHead className="font-bold text-accent">Desconto (R$)</TableHead>
                <TableHead className="font-bold flex items-center gap-1"><Calendar size={14} /> Atualizado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">{getFactoryName(p.factoryId)}</Badge>
                  </TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell className="text-primary font-semibold">
                    R$ {(p.closedLoadPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    R$ {(p.fractionalLoadPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {p.discountAmount && p.discountAmount > 0 ? (
                      <div className="flex items-center gap-1.5 text-accent font-bold">
                        <Tag size={14} />
                        R$ {p.discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {p.lastPriceUpdateAt ? (
                      typeof p.lastPriceUpdateAt === 'string' 
                        ? format(new Date(p.lastPriceUpdateAt), "dd/MM/yyyy", { locale: ptBR })
                        : format(p.lastPriceUpdateAt.toDate(), "dd/MM/yyyy", { locale: ptBR })
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
