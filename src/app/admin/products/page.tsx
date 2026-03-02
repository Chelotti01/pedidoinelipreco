
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Package, Edit, Trash2, ChevronLeft, Upload, AlertTriangle, Copy, Search, FilterX, AlertCircle, Factory } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STORAGE_KEY = 'products_filters_state';

export default function RegisteredProductsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  
  // States para busca e filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);

  // Carregar filtros salvos no mount
  useEffect(() => {
    const savedFilters = sessionStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setSearchTerm(parsed.searchTerm || "");
        setStatusFilter(parsed.statusFilter || "all");
        setBrandFilter(parsed.brandFilter || "all");
        setLineFilter(parsed.lineFilter || "all");
        setLinkFilter(parsed.linkFilter || "all");
        setFactoryFilter(parsed.factoryFilter || "all");
      } catch (e) {
        console.error("Erro ao carregar filtros", e);
      }
    }
    setIsLoadedFromStorage(true);
  }, []);

  // Salvar filtros sempre que mudarem
  useEffect(() => {
    if (isLoadedFromStorage) {
      const filters = { searchTerm, statusFilter, brandFilter, lineFilter, linkFilter, factoryFilter };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    }
  }, [searchTerm, statusFilter, brandFilter, lineFilter, linkFilter, factoryFilter, isLoadedFromStorage]);

  const productsQuery = useMemoFirebase(() => {
    return query(collection(db, 'registered_products'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: products, isLoading } = useCollection(productsQuery);

  const catalogQuery = useMemoFirebase(() => query(collection(db, 'catalog_products')), [db]);
  const { data: catalogProducts } = useCollection(catalogQuery);

  const factoriesQuery = useMemoFirebase(() => query(collection(db, 'factories'), orderBy('name')), [db]);
  const { data: factories } = useCollection(factoriesQuery);

  // Extrair marcas únicas para o filtro
  const uniqueBrands = useMemo(() => {
    if (!products) return [];
    const brands = products.map(p => p.brand).filter(Boolean);
    return Array.from(new Set(brands)).sort();
  }, [products]);

  // Extrair linhas únicas para o filtro
  const uniqueLines = useMemo(() => {
    if (!products) return [];
    const lines = products.map(p => p.line).filter(Boolean);
    return Array.from(new Set(lines)).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.map(p => {
      // Verifica se o vínculo existe mas o produto sumiu do catálogo
      const hasLinkId = !!p.catalogProductId;
      const targetExists = hasLinkId && catalogProducts?.some(cp => cp.id === p.catalogProductId);
      const isLinkBroken = hasLinkId && !targetExists;

      return {
        ...p,
        isLinkBroken,
        isLinked: hasLinkId && targetExists,
        isUnlinked: !hasLinkId
      };
    }).filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm.trim() || (
        p.code?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term) ||
        p.ean?.toLowerCase().includes(term)
      );

      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesBrand = brandFilter === "all" || p.brand === brandFilter;
      const matchesLine = lineFilter === "all" || p.line === lineFilter;
      const matchesFactory = factoryFilter === "all" || p.factoryId === factoryFilter;
      
      const matchesLink = linkFilter === "all" || 
        (linkFilter === "linked" && p.isLinked) || 
        (linkFilter === "broken" && p.isLinkBroken) ||
        (linkFilter === "unlinked" && p.isUnlinked);

      return matchesSearch && matchesStatus && matchesBrand && matchesLine && matchesLink && matchesFactory;
    });
  }, [products, catalogProducts, searchTerm, statusFilter, brandFilter, lineFilter, linkFilter, factoryFilter]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBrandFilter("all");
    setLineFilter("all");
    setLinkFilter("all");
    setFactoryFilter("all");
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(db, 'registered_products', id));
    toast({ title: "Produto excluído", description: "O registro foi removido com sucesso." });
  };

  const handleDuplicate = (product: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, isLinkBroken, isLinked, isUnlinked, ...data } = product;
    addDocumentNonBlocking(collection(db, 'registered_products'), {
      ...data,
      code: `${data.code}-cópia`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast({ 
      title: "Produto duplicado", 
      description: "Uma cópia foi criada com sucesso. Você já pode editá-la." 
    });
  };

  const handleDeleteAll = () => {
    if (!products || products.length === 0) return;
    
    products.forEach((p) => {
      deleteDocumentNonBlocking(doc(db, 'registered_products', p.id));
    });

    toast({ 
      title: "Limpeza concluída", 
      description: `${products.length} produtos foram removidos do sistema.`,
      variant: "destructive"
    });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Produtos Registrados</h1>
            <p className="text-muted-foreground">Gerencie o cadastro paralelo e vínculos de preços.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {products && products.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2 shadow-sm">
                  <Trash2 size={18} /> Excluir Tudo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-destructive" /> Atenção!
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação excluirá permanentemente todos os <strong>{products.length} produtos</strong> cadastrados. 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, excluir tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Link href="/admin/products/import">
            <Button variant="outline" className="gap-2 bg-white">
              <Upload size={18} /> Importar
            </Button>
          </Link>
          <Link href="/admin/products/new">
            <Button className="gap-2 shadow-lg hover:shadow-primary/20">
              <Plus size={18} /> Novo Produto
            </Button>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="mb-8 border-none shadow-sm bg-muted/30">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
            <div className="relative col-span-1 sm:col-span-2 md:col-span-1">
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Active">Ativos</SelectItem>
                <SelectItem value="Inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={linkFilter} onValueChange={setLinkFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Vínculo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vínculos</SelectItem>
                <SelectItem value="linked">Vínculo OK (Verde)</SelectItem>
                <SelectItem value="broken">Vínculo Quebrado (Amarelo)</SelectItem>
                <SelectItem value="unlinked">Não Vinculado (Vermelho)</SelectItem>
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

      <Card className="border-none shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Código/Descrição</TableHead>
              <TableHead>Marca/Linha</TableHead>
              <TableHead>Unidade/Qtd</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">Carregando produtos...</TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                  <Package className="mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-muted-foreground font-medium">Nenhum produto encontrado com esses filtros.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <Badge variant={p.status === 'Active' ? 'default' : 'secondary'} className="px-3">
                      {p.status === 'Active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div 
                        className={`h-4 w-4 rounded-full shrink-0 border-2 border-white shadow-sm 
                          ${p.isLinked ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 
                            p.isLinkBroken ? 'bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 
                            'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
                        title={p.isLinked ? 'Vínculo OK' : p.isLinkBroken ? 'Vínculo Quebrado (Item não encontrado no catálogo)' : 'Sem Vínculo'}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-800">{p.code}</span>
                          {p.isLinkBroken && <AlertCircle size={12} className="text-yellow-600" title="Vínculo Quebrado" />}
                        </div>
                        <span className="text-[11px] text-muted-foreground line-clamp-1 uppercase font-medium">{p.description}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-700">{p.brand}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{p.line}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{p.unit} ({p.quantityPerBox} cx)</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.ean}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Duplicar" onClick={() => handleDuplicate(p)} className="h-8 w-8 text-primary/70 hover:text-primary hover:bg-primary/10">
                        <Copy size={16} />
                      </Button>
                      <Link href={`/admin/products/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-primary hover:bg-primary/10">
                          <Edit size={16} />
                        </Button>
                      </Link>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                            <Trash2 size={16} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir este item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja realmente excluir o produto <strong>{p.description}</strong>? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir Item
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      
      <div className="mt-8 flex flex-col md:flex-row gap-6 text-xs text-muted-foreground items-center justify-between px-4 bg-muted/20 py-4 rounded-lg">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="font-medium">Vínculo OK</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="font-medium">Vínculo Quebrado (Refaça a amarração)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="font-medium">Sem Vínculo (Requer Amarração)</span>
          </div>
        </div>
        <p className="italic">Total de {filteredProducts.length} itens encontrados.</p>
      </div>
    </div>
  );
}
