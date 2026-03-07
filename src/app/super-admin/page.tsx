"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { 
  ShieldCheck, Building2, UserPlus, Trash2, 
  Plus, Loader2, ChevronLeft, Building 
} from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function SuperAdminPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // Verificar se o usuário atual é super admin para carregar os dados
  const userProfileQuery = useMemoFirebase(() => 
    user?.email ? query(collection(db, 'userProfiles'), where('email', '==', user.email), limit(1)) : null
  , [db, user]);
  const { data: profiles } = useCollection(userProfileQuery);
  const profile = profiles?.[0];

  const isSuperAdmin = profile?.role === 'superAdmin' || user?.email === 'vendas.piracanjuba@gmail.com';

  const organizationsQuery = useMemoFirebase(() => 
    isSuperAdmin ? query(collection(db, 'organizations'), orderBy('name')) : null
  , [db, isSuperAdmin]);
  const { data: organizations, isLoading: isOrgsLoading } = useCollection(organizationsQuery);

  const [newOrg, setNewOrg] = useState({ id: '', name: '' });
  const [newUser, setNewUser] = useState({ email: '', name: '', organizationId: '', role: 'admin' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.id || !newOrg.name) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(doc(db, 'organizations', newOrg.id), {
        ...newOrg,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Organização criada!" });
      setNewOrg({ id: '', name: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.organizationId) return;
    setIsSubmitting(true);
    try {
      // Criar o perfil de usuário. O sistema buscará pelo e-mail no login.
      await addDocumentNonBlocking(collection(db, 'userProfiles'), {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Perfil de usuário pré-cadastrado!" });
      setNewUser({ email: '', name: '', organizationId: '', role: 'admin' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <ShieldCheck size={64} className="mx-auto text-destructive opacity-20" />
          <h1 className="text-2xl font-black">ACESSO NEGADO</h1>
          <p className="text-muted-foreground">Você não tem permissões de Super Administrador para acessar esta área.</p>
          <Link href="/"><Button variant="outline">Voltar ao Início</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-10 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon"><ChevronLeft /></Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl text-white shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary">ÁREA SUPER ADMIN</h1>
            <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">Gestão Global da Plataforma SaaS</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="orgs" className="space-y-8">
        <TabsList className="grid w-full grid-cols-2 h-14 bg-white shadow-sm rounded-xl border p-1">
          <TabsTrigger value="orgs" className="gap-2 font-black text-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Building2 size={20} /> ORGANIZAÇÕES
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 font-black text-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <UserPlus size={20} /> USUÁRIOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 shadow-xl border-none">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-xl">Nova Organização</CardTitle>
                <CardDescription>Cadastre um novo cliente tenant.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div className="space-y-2">
                    <Label>ID Único (Slug)</Label>
                    <Input 
                      placeholder="ex: empresa-a" 
                      value={newOrg.id} 
                      onChange={(e) => setNewOrg({...newOrg, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})} 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Oficial</Label>
                    <Input 
                      placeholder="Ex: Comercial Alimentos LTDA" 
                      value={newOrg.name} 
                      onChange={(e) => setNewOrg({...newOrg, name: e.target.value})} 
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus size={18} />} Criar Tenant
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-xl border-none overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="font-black">ID</TableHead>
                    <TableHead className="font-black">NOME</TableHead>
                    <TableHead className="font-black text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isOrgsLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-10">Carregando...</TableCell></TableRow>
                  ) : organizations?.map(org => (
                    <TableRow key={org.id}>
                      <TableCell className="font-mono text-xs font-bold">{org.id}</TableCell>
                      <TableCell className="font-bold">{org.name}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'organizations', org.id))}>
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-8">
          <Card className="shadow-xl border-none">
            <CardHeader className="bg-primary/5">
              <CardTitle>Pré-cadastro de Usuários</CardTitle>
              <CardDescription>Vincule e-mails a organizações e defina cargos.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input 
                    type="email" 
                    placeholder="vendedor@empresa.com" 
                    value={newUser.email} 
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input 
                    placeholder="João Silva" 
                    value={newUser.name} 
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Organização</Label>
                  <Select value={newUser.organizationId} onValueChange={(val) => setNewUser({...newUser, organizationId: val})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {organizations?.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="h-10 font-bold" disabled={isSubmitting || organizations?.length === 0}>
                  Vincular Usuário
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}