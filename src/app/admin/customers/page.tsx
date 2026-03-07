
"use client"

import { useState, useMemo } from 'react';
import { useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useFirestore, deleteDocumentNonBlocking } from '@/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Edit, Trash2, ChevronLeft, Search, AlertTriangle, Loader2 } from "lucide-react";
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

export default function CustomersPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  // Get user profile for organizationId
  const userProfileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const customersQuery = useMemoFirebase(() => {
    return orgId ? query(collection(db, 'organizations', orgId, 'clients'), orderBy('name', 'asc')) : null;
  }, [db, orgId]);

  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchTerm.trim()) return customers;
    
    const term = searchTerm.toLowerCase();
    return customers.filter((c) => {
      return (
        c.name?.toLowerCase().includes(term) ||
        c.cnpj?.toLowerCase().includes(term)
      );
    });
  }, [customers, searchTerm]);

  const handleDelete = (id: string) => {
    if (!orgId) return;
    deleteDocumentNonBlocking(doc(db, 'organizations', orgId, 'clients', id));
    toast({ title: "Cliente excluído", description: "O registro foi removido com sucesso." });
  };

  const isLoading = isProfileLoading || isCustomersLoading;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground">Gerencie sua base de clientes ({orgId}).</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/customers/new">
            <Button className="gap-2">
              <Plus size={18} /> Novo Cliente
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input 
          placeholder="Pesquisar por nome ou CNPJ..." 
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Tipo Carga</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="animate-spin mx-auto mb-2" />
                  Carregando clientes...
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20">
                  <Users className="mx-auto mb-4 opacity-20" size={48} />
                  <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.name}</TableCell>
                  <TableCell>{c.cnpj}</TableCell>
                  <TableCell>{c.paymentTerm}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.loadType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/customers/${c.id}`}>
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
                            <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja realmente excluir o cliente <strong>{c.name}</strong>?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
    </div>
  );
}
