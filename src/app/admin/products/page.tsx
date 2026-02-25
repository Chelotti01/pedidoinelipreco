
"use client"

import { useState, useMemo } from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Edit, Trash2, ChevronLeft, Upload, AlertTriangle, Copy, Search } from "lucide-react";
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

export default function RegisteredProductsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const productsQuery = useMemoFirebase(() => {
    return query(collection(db, 'registered_products'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: products, isLoading } = useCollection(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter((p) => {
      return (
        p.code?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term) ||
        p.line?.toLowerCase().includes(term) ||
        p.ean?.toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  const handleDelete = (id: string) => {
    deleteDocumentNonBlocking(doc(db, 'registered_products', id));
    toast({ title: "Produto excluído", description: "O registro foi removido com sucesso." });
  };

  const handleDuplicate = (product: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...data } = product;
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
          <Link href="/" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produtos Registrados</h1>
            <p className="text-muted-foreground">Gerencie o cadastro paralelo para vendedores.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {products && products.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
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
            <Button variant="outline" className="gap-2">
              <Upload size={18} /> Importar
            </Button>
          </Link>
          <Link href="/admin/products/new">
            <Button className="gap-2">
              <Plus size={18} /> Novo Produto
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input 
          placeholder="Pesquisar por código, nome, marca, EAN..." 
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

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
                  <p className="text-muted-foreground">Nenhum produto encontrado.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant={p.status === 'Active' ? 'default' : 'secondary'}>
                      {p.status === 'Active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div 
                        className={`h-3.5 w-3.5 rounded-full shrink-0 ${p.catalogProductId ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}
                        title={p.catalogProductId ? 'Vinculado ao Catálogo' : 'Não Vinculado'}
                      />
                      <div>
                        <div className="font-bold">{p.code}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{p.brand}</div>
                    <div className="text-xs text-muted-foreground">{p.line}</div>
                  </TableCell>
                  <TableCell>
                    {p.unit} ({p.quantityPerBox} cx)
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.ean}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Duplicar" onClick={() => handleDuplicate(p)}>
                        <Copy size={16} />
                      </Button>
                      <Link href={`/admin/products/${p.id}`}>
                        <Button variant="ghost" size="icon"><Edit size={16} /></Button>
                      </Link>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 size={16} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja realmente excluir o produto <strong>{p.description}</strong>?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
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
      
      <div className="mt-6 flex gap-6 text-sm text-muted-foreground items-center justify-end px-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Vinculado ao Catálogo (Preço OK)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span>Sem Vínculo (Ficha incompleta)</span>
        </div>
      </div>
    </div>
  );
}
