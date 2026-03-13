
"use client"

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronLeft, Save, Loader2, ListPlus, Wand2, Pencil, X } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

const PRICE_TABLE_CATEGORIES_DEFAULT = [
  { name: "LEITES PIRACANJUBA", codes: ["10317", "10318", "10319"] },
  { name: "LEITES PIRACANJUBA ZERO LACTOSE", codes: ["12409", "12411", "12438"] },
  { name: "LEITES PIRACANJUBA ESPECIAIS", codes: ["10326", "10327", "10328", "12436"] },
  { name: "LEITES NESTLE", codes: ["502429", "502431", "502433"] },
  { name: "LEITES NESTLE ZERO LACTOSE", codes: ["502430", "502432", "502434", "502435", "502439"] },
  { name: "LEITE EM PÓ ALMOFADA", codes: ["10206", "10218", "10230", "10204", "10217", "10229", "10211", "10219"] },
  { name: "LEITE EM PÓ POUCH", codes: ["10238", "10239", "10240"] },
  { name: "LEITE EM PÓ PRODUÇÃO 25KG", codes: ["10201", "10202"] },
  { name: "LEITE EM PÓ LATA", codes: ["10271", "10299", "10200", "10222", "10223", "10283", "10284", "10295"] },
  { name: "COMPOSTO LÁCTEO ÓTIMO", codes: ["200222", "200223", "200254", "200255"] },
  { name: "CREME DE LEITE", codes: ["12201", "12218", "12219", "12220", "12221"] },
  { name: "LEITE CONDENSADO", codes: ["12301", "12307", "12320", "12332", "12333", "12334", "12335", "12603"] },
  { name: "BEBIDAS LÁCTEAS PIRAKIDS", codes: ["12003", "12016", "12017", "12019"] },
  { name: "PROFORCE 250ML 23g", codes: ["12026", "12027", "12557", "12559", "12564"] },
  { name: "PROFORCE 250ML 15g", codes: ["12572", "12573", "12574", "12575", "12576", "12591"] },
  { name: "BEBIDA LÁCTEA MILKYMOO 250ML 15g", codes: ["12579", "12590"] },
  { name: "BEBIDA LÁCTEA ZQUAD 250ML 10g", codes: ["12587", "12588", "12589"] },
  { name: "WHEY EM PÓ 450g", codes: ["12577", "12578"] },
  { name: "BEBIDAS LÁCTEAS QLC", codes: ["12509", "12513", "12521", "12547"] },
  { name: "BEBIDA ALMOND BREEZE", codes: ["272800", "272801", "272802", "272807", "272809", "272810", "272813"] },
  { name: "QUEIJO RALADO", codes: ["11104", "11105"] },
  { name: "MANTEIGAS", codes: ["10417", "10401", "10402", "10405", "10418", "10419", "10421"] },
  { name: "QUEIJOS", codes: ["10601", "10602", "10605", "10606", "10901", "10903", "11001", "11005", "11010", "11013", "11014", "11017", "11028", "11023", "11101", "11119", "11118", "11201", "11204", "11216", "11226", "11503", "11519", "11509", "11510", "11520", "11607", "11608", "11609", "11610"] },
  { name: "SUPLEMENTOS ALIMENTARES EMANA", codes: ["322500", "322502", "322503", "322504", "323101", "323102", "323103", "323104", "323105", "323106", "323107", "323108", "323109", "323110", "323111", "323112", "323201", "323202", "323203", "323301", "323302", "323303", "323304", "323305", "323306", "323307", "323308", "323309", "323310", "323311", "323312", "323313", "323314", "323315", "323316", "323317", "323318", "323319", "323324", "323325", "323326", "323327", "323328", "323329", "323336", "323338", "323342", "323343"] }
];

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
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOrUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !newGroup.name) return;

    setIsSubmitting(true);
    try {
      const codesArray = newGroup.codes
        .split(/[\n,;]+/)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const groupData = {
        name: newGroup.name,
        codes: codesArray,
        order: Number(newGroup.order) || 0,
        updatedAt: serverTimestamp()
      };

      if (editingGroupId) {
        await updateDocumentNonBlocking(doc(db, 'organizations', orgId, 'pdfGroups', editingGroupId), groupData);
        toast({ title: "Grupo atualizado", description: "As alterações foram salvas com sucesso." });
      } else {
        await addDocumentNonBlocking(collection(db, 'organizations', orgId, 'pdfGroups'), {
          ...groupData,
          createdAt: serverTimestamp()
        });
        toast({ title: "Grupo criado", description: "O grupo foi adicionado às configurações do PDF." });
      }

      setNewGroup({ name: '', codes: '', order: (groups?.length || 0) + 1 });
      setEditingGroupId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setNewGroup({
      name: group.name,
      codes: group.codes?.join('\n') || '',
      order: group.order || 0
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setNewGroup({ name: '', codes: '', order: (groups?.length || 0) + 1 });
  };

  const handleLoadDefaults = async () => {
    if (!orgId) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      PRICE_TABLE_CATEGORIES_DEFAULT.forEach((cat, index) => {
        const newDocRef = doc(collection(db, 'organizations', orgId, 'pdfGroups'));
        batch.set(newDocRef, {
          name: cat.name,
          codes: cat.codes,
          order: index + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast({ title: "Lista padrão importada", description: "Agora você pode editar ou excluir os grupos conforme necessário." });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao importar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = (id: string) => {
    if (!orgId) return;
    deleteDocumentNonBlocking(doc(db, 'organizations', orgId, 'pdfGroups', id));
    toast({ title: "Grupo removido" });
    if (editingGroupId === id) handleCancelEdit();
  };

  const isLoading = isProfileLoading || isGroupsLoading;

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Grupos do PDF</h1>
            <p className="text-muted-foreground">Configure as categorias e a ordem dos produtos no PDF ({orgId}).</p>
          </div>
        </div>
        {(!groups || groups.length === 0) && (
          <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5 font-bold" onClick={handleLoadDefaults} disabled={isSubmitting}>
            <Wand2 size={18} /> Carregar Lista Padrão
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className={`shadow-xl border-none ${editingGroupId ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2">
                {editingGroupId ? <Pencil size={18} className="text-primary" /> : <ListPlus size={18} className="text-primary" />} 
                {editingGroupId ? 'Editar Grupo' : 'Novo Grupo'}
              </CardTitle>
              <CardDescription>Defina o nome e os códigos que pertencem a esta seção.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateOrUpdateGroup} className="space-y-4">
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
                  <p className="text-[10px] text-muted-foreground italic">Dica: Acrescente novos códigos um por linha ou separados por vírgula.</p>
                </div>
                
                <div className="flex gap-2">
                  {editingGroupId && (
                    <Button type="button" variant="outline" className="flex-1 gap-2" onClick={handleCancelEdit}>
                      <X size={16} /> Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="flex-[2] gap-2 h-12 font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                    {editingGroupId ? 'Atualizar Grupo' : 'Salvar Grupo'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-xl border-none overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead className="w-[60px] text-center">Ordem</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Códigos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!groups || groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                      Nenhum grupo configurado.
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id} className={editingGroupId === group.id ? 'bg-primary/5' : ''}>
                      <TableCell className="text-center font-black text-primary">{group.order}</TableCell>
                      <TableCell className="font-bold">{group.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {group.codes?.slice(0, 3).map((code: string) => (
                            <Badge key={code} variant="secondary" className="text-[9px]">{code}</Badge>
                          ))}
                          {group.codes?.length > 3 && <span className="text-[10px] text-muted-foreground">+{group.codes.length - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="text-slate-600" onClick={() => handleEditGroup(group)}>
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
