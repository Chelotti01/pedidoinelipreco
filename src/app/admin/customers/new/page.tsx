
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, addDocumentNonBlocking, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, UserPlus, Loader2 } from "lucide-react";
import Link from 'next/link';

export default function NewCustomerPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // Get user profile for organizationId via Email
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    paymentTerm: '',
    loadType: 'Paletizada',
    observations: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    
    if (!formData.name || !formData.cnpj) {
      toast({ title: "Erro no cadastro", description: "Nome e CNPJ são obrigatórios.", variant: "destructive" });
      return;
    }

    addDocumentNonBlocking(collection(db, 'organizations', orgId, 'clients'), {
      ...formData,
      organizationId: orgId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    toast({ title: "Cliente cadastrado", description: "O cliente foi registrado com sucesso." });
    router.push('/admin/customers');
  };

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/admin/customers" className="text-muted-foreground hover:text-primary">
          <ChevronLeft size={28} />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Novo Cliente</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus size={18} className="text-primary" /> Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo / Razão Social</Label>
              <Input 
                required 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="Ex: Comercial de Alimentos LTDA"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input 
                required 
                value={formData.cnpj} 
                onChange={(e) => setFormData({...formData, cnpj: e.target.value})} 
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo de Pagamento</Label>
                <Input 
                  value={formData.paymentTerm} 
                  onChange={(e) => setFormData({...formData, paymentTerm: e.target.value})} 
                  placeholder="Ex: 28/35/42 dias"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Carga</Label>
                <Select value={formData.loadType} onValueChange={(val) => setFormData({...formData, loadType: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paletizada">Paletizada</SelectItem>
                    <SelectItem value="Batida">Batida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={formData.observations} 
                onChange={(e) => setFormData({...formData, observations: e.target.value})} 
                placeholder="Detalhes adicionais, restrições de entrega, etc."
                className="min-h-[120px]"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-6">
            <Button type="submit" className="w-full gap-2 h-12 text-lg font-bold" disabled={!orgId}>
              <Save size={20} /> Salvar Cliente
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
