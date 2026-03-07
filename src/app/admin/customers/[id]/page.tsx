
"use client"

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, ChevronLeft, UserCircle, Loader2, AlertCircle } from "lucide-react";
import Link from 'next/link';

export default function EditCustomerPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // OBRIGATÓRIO: Buscar perfil pelo e-mail para SaaS
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  // Referência do cliente vinculada à organização
  const customerRef = useMemoFirebase(() => (id && orgId) ? doc(db, 'organizations', orgId, 'clients', id) : null, [db, id, orgId]);
  const { data: customer, isLoading: isCustomerLoading } = useDoc(customerRef);

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    paymentTerm: '',
    loadType: 'Paletizada',
    observations: ''
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        cnpj: customer.cnpj || '',
        paymentTerm: customer.paymentTerm || '',
        loadType: customer.loadType || 'Paletizada',
        observations: customer.observations || ''
      });
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerRef || !orgId) return;

    if (!formData.name || !formData.cnpj) {
      toast({ title: "Erro ao salvar", description: "Nome e CNPJ são obrigatórios.", variant: "destructive" });
      return;
    }

    updateDocumentNonBlocking(customerRef, {
      ...formData,
      organizationId: orgId,
      updatedAt: serverTimestamp()
    });

    toast({ title: "Cliente atualizado", description: "As alterações foram salvas com sucesso." });
    router.push('/admin/customers');
  };

  if (isProfileLoading || isCustomerLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertCircle size={64} className="mx-auto text-destructive opacity-20 mb-4" />
        <h2 className="text-2xl font-bold">Erro de Vínculo</h2>
        <p className="text-muted-foreground">Seu perfil não possui uma organização associada.</p>
        <Link href="/"><Button variant="outline" className="mt-6">Voltar</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/admin/customers" className="text-muted-foreground hover:text-primary">
          <ChevronLeft size={28} />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Editar Cliente</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-lg">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCircle size={18} className="text-primary" /> Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo / Razão Social</Label>
              <Input 
                required 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input 
                required 
                value={formData.cnpj} 
                onChange={(e) => setFormData({...formData, cnpj: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo de Pagamento</Label>
                <Input 
                  value={formData.paymentTerm} 
                  onChange={(e) => setFormData({...formData, paymentTerm: e.target.value})} 
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
                className="min-h-[120px]"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-6">
            <Button type="submit" className="w-full gap-2 h-12 text-lg font-bold">
              <Save size={20} /> Salvar Alterações
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
