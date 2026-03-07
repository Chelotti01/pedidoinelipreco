
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { intelligentlyProcessPriceSheet } from '@/ai/flows/intelligently-process-price-sheet-flow';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, ArrowRight, Zap, Trash2, AlertTriangle } from "lucide-react";
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import Link from 'next/link';
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

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const sanitizeId = (text: string) => text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleClearDatabase = async () => {
    if (!orgId) return;
    setIsDeleting(true);
    try {
      const catalogSnap = await getDocs(collection(db, 'organizations', orgId, 'productFactoryPrices'));
      const factoriesSnap = await getDocs(collection(db, 'organizations', orgId, 'factories'));
      const batch = writeBatch(db);
      catalogSnap.forEach((d) => batch.delete(d.ref));
      factoriesSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Banco de dados limpo" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !orgId) return;
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        try {
          const result = await intelligentlyProcessPriceSheet({ xlsxDataUri: dataUri });
          const allOps: {ref: any, data: any}[] = [];
          for (const factoryData of result) {
            const factoryId = sanitizeId(factoryData.factoryName);
            if (!factoryId) continue;
            allOps.push({ ref: doc(db, 'organizations', orgId, 'factories', factoryId), data: { name: factoryData.factoryName, organizationId: orgId, updatedAt: serverTimestamp() } });
            for (const product of factoryData.products) {
              const productId = `${factoryId}-${sanitizeId(product.name)}-${sanitizeId(product.unit)}`;
              allOps.push({ 
                ref: doc(db, 'organizations', orgId, 'productFactoryPrices', productId), 
                data: { name: product.name, unit: product.unit, closedLoadPrice: product.closedLoadPrice, fractionalLoadPrice: product.fractionalLoadPrice, discountAmount: product.discountAmount || 0, factoryId, organizationId: orgId, lastPriceUpdateAt: serverTimestamp() } 
              });
            }
          }
          for (let i = 0; i < allOps.length; i += 400) {
            const batch = writeBatch(db);
            allOps.slice(i, i + 400).forEach(op => batch.set(op.ref, op.data, { merge: true }));
            await batch.commit();
          }
          setIsSuccess(true);
          toast({ title: "Processamento concluído" });
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Zap size={24} className="text-primary" />
          <h1 className="text-2xl font-bold text-primary">Pedido InteliPreço ({orgId})</h1>
        </Link>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive"><Trash2 size={16} className="mr-2" /> Limpar Catálogo</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Limpar Banco de Dados?</AlertDialogTitle><AlertDialogDescription>Isso excluirá os produtos e fábricas da sua organização.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleClearDatabase} className="bg-destructive">Sim, apagar tudo</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="border-2 border-dashed border-primary/20 bg-white shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4"><FileSpreadsheet size={32} /></div>
          <CardTitle>Atualizar Tabela de Preços</CardTitle>
          <CardDescription>Importe o XLSX para atualizar os preços da sua organização.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid w-full gap-2">
              <Label htmlFor="xlsx-file">Arquivo Excel</Label>
              <Input id="xlsx-file" type="file" accept=".xlsx" onChange={handleFileChange} disabled={isDeleting} />
            </div>
            <Button className="w-full h-12 text-lg font-semibold gap-2" onClick={handleUpload} disabled={isLoading || !file || !orgId}>
              {isLoading ? <Loader2 className="animate-spin" /> : <UploadCloud size={20} />} Processar Preços
            </Button>
          </div>
        </CardContent>
        {isSuccess && (
          <CardFooter className="bg-accent/5 flex flex-col items-center gap-4 py-6 border-t">
            <div className="flex items-center gap-2 text-accent font-bold"><CheckCircle2 size={24} /> Sucesso!</div>
            <Link href="/admin/products" className="w-full"><Button variant="outline" className="w-full h-12">Fazer Amarração <ArrowRight className="ml-2" /></Button></Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
