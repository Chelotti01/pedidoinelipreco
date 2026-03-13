"use client"

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronLeft, LayoutList, Save, Loader2, ListPlus } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function PDFGroupsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const groupsQuery = useMemoFirebase(() => 
    orgId ? query(collection(db, 'organizations', orgId, 'pdfGroups'), orderBy('order', 'asc')) : null
  , [db, orgId]);
  const { data: groups, isLoading: isGroupsLoading } = useCollection(groupsQuery);

  const [newGroup, setNewGroup] = useState({ name: '', codes: '', order: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !newGroup.name) return;

    setIsSubmitting(true);
    try {
      const codesArray = newGroup.codes
        .split(/[\n,;]+/)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      await addDocumentNonBlocking(collection(db, 'organizations', orgId, 'pdfGroups'), {
        name: newGroup.name,
        codes: codesArray,
        order: Number(newGroup.order) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Grupo criado", description: "O grupo foi adicionado às configurações do PDF." });
      setNewGroup({ name: '', codes: '', order: (groups?.length || 0) + 1 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = (id: string) => {
    if (!orgId) return;
    deleteDocumentNonBlocking(doc(db, 'organizations', orgId, 'pdfGroups', id));
    toast({ title: "Grupo removido" });
  };

  const isLoading = isProfileLoading || isGroupsLoading;

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-primary">
          <ChevronLeft size={28} />
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Grupos do PDF</h1>
          <p className="text-muted-foreground">Configure as categorias e a ordem dos produtos no PDF ({orgId}).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="shadow-xl border-none">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListPlus size={18} className="text-primary" /> Novo Grupo
              </CardTitle>
              <CardDescription>Defina o nome e os códigos que pertencem a esta seção.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Grupo</Label>
                  <Input 
                    placeholder="Ex: LEITES UHT" 
                    value={newGroup.name} 
                    onChange={(e) => setNewGroup({...newGroup, name: e.target.value.toUpperCase()})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordem de Exibição</Label>
                  <Input 
                    type="number" 
                    value={newGroup.order} 
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewGroup({...newGroup, order: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Códigos dos Produtos (um por linha)</Label>
                  <Textarea 
                    placeholder="10317&#10;10318&#10;10319" 
                    className="min-h-[200px] font-mono text-xs"
                    value={newGroup.codes}
                    onChange={(e) => setNewGroup({...newGroup, codes: e.target.value})}
                  />
                  <p className="text-[10px] text-muted-foreground italic">Você pode separar por vírgula ou nova linha.</p>
                </div>
                <Button type="submit" className="w-full gap-2 h-12 font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus size={18} />} Salvar Grupo
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-xl border-none overflow-hidden">
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="w-[60px] text-center">Ordem</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Códigos Vinculados</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!groups || groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                    Nenhum grupo configurado. O PDF usará a lista padrão do sistema.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="text-center font-black text-primary">{group.order}</TableCell>
                    <TableCell className="font-bold">{group.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[300px]">
                        {group.codes?.slice(0, 5).map((code: string) => (
                          <Badge key={code} variant="secondary" className="text-[9px]">{code}</Badge>
                        ))}
                        {group.codes?.length > 5 && <span className="text-[10px] text-muted-foreground">+{group.codes.length - 5} itens</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Card>
        </div>
      </div>
    </div>
  );
}