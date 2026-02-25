"use client"

import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Edit, Trash2, ChevronLeft } from "lucide-react";
import Link from 'next/link';

export default function RegisteredProductsPage() {
  const db = useFirestore();
  const productsQuery = useMemoFirebase(() => {
    return query(collection(db, 'registered_products'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: products, isLoading } = useCollection(productsQuery);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produtos Registrados</h1>
            <p className="text-muted-foreground">Gerencie o cadastro paralelo para vendedores.</p>
          </div>
        </div>
        <Link href="/admin/products/new">
          <Button className="gap-2">
            <Plus size={18} /> Novo Produto
          </Button>
        </Link>
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
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                  <Package className="mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
                </TableCell>
              </TableRow>
            ) : (
              products?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant={p.status === 'Active' ? 'default' : 'secondary'}>
                      {p.status === 'Active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold">{p.code}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
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
                      <Button variant="ghost" size="icon"><Edit size={16} /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive"><Trash2 size={16} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
