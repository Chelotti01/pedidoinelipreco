"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { intelligentlyProcessPriceSheet } from '@/ai/flows/intelligently-process-price-sheet-flow';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { saveStoredData } from '@/lib/store';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  /**
   * Sanitiza uma string para ser usada como ID no Firestore de forma determinística.
   * Colapsa múltiplos espaços para garantir que nomes visualmente iguais gerem o mesmo ID.
   */
  const sanitizeId = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\s+/g, ' ')            // Colapsa múltiplos espaços em um só
      .replace(/[^a-z0-9]+/g, '-')     // Substitui caracteres especiais por hífen
      .replace(/^-+|-+$/g, '');        // Remove hífens no início ou fim
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Arquivo não selecionado",
        description: "Por favor, selecione um arquivo XLSX para processar.",
        variant: "destructive"
      });
      return;
    }

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

            const factoryRef = doc(db, 'factories', factoryId);
            
            allOps.push({ 
              ref: factoryRef, 
              data: { 
                name: factoryData.factoryName, 
                updatedAt: serverTimestamp() 
              } 
            });

            for (const product of factoryData.products) {
              const safeProductName = sanitizeId(product.name);
              const safeUnit = sanitizeId(product.unit);
              
              if (!safeProductName) continue;

              // O ID é fixo baseado na fábrica, nome e unidade. 
              // Se o item já existir, o Firestore irá atualizar (merge), não duplicar.
              const productId = `${factoryId}-${safeProductName}-${safeUnit}`;
              const productRef = doc(db, 'catalog_products', productId);
              
              allOps.push({ 
                ref: productRef, 
                data: {
                  name: product.name,
                  unit: product.unit,
                  closedLoadPrice: product.closedLoadPrice,
                  fractionalLoadPrice: product.fractionalLoadPrice,
                  discountAmount: product.discountAmount || 0,
                  factoryId: factoryId,
                  lastPriceUpdateAt: serverTimestamp()
                } 
              });
            }
          }

          // Processamento em lotes (batch)
          for (let i = 0; i < allOps.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = allOps.slice(i, i + 400);
            chunk.forEach(op => batch.set(op.ref, op.data, { merge: true }));
            await batch.commit();
          }

          saveStoredData(result);

          setIsSuccess(true);
          toast({
            title: "Processamento concluído",
            description: `A tabela foi processada. Itens existentes foram atualizados e novos foram adicionados.`,
          });
        } catch (error: any) {
          console.error(error);
          toast({
            title: "Erro no processamento",
            description: error.message || "Não foi possível extrair ou salvar os dados.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      toast({
        title: "Erro ao ler arquivo",
        description: "Ocorreu um erro inesperado ao ler o arquivo.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Zap size={24} className="text-primary" />
          <h1 className="text-2xl font-bold text-primary">Pedido InteliPreço</h1>
        </Link>
        <Link href="/catalog">
           <Button variant="ghost" size="sm">Ver Catálogo</Button>
        </Link>
      </div>

      <Card className="border-2 border-dashed border-primary/20 bg-white shadow-xl">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <FileSpreadsheet size={32} />
          </div>
          <CardTitle className="text-2xl">Atualizar Tabela de Preços</CardTitle>
          <CardDescription>
            Importe o arquivo .xlsx. Itens com o mesmo nome e unidade serão atualizados, evitando duplicidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="xlsx-file" className="text-sm font-semibold">Selecione o arquivo Excel</Label>
              <Input 
                id="xlsx-file" 
                type="file" 
                accept=".xlsx" 
                onChange={handleFileChange}
                className="cursor-pointer file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:mr-4 file:px-4 file:py-2 hover:border-primary transition-colors"
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-accent" />
                  Arquivo selecionado: {file.name}
                </p>
              )}
            </div>

            <Button 
              className="w-full h-12 text-lg font-semibold gap-2 transition-all hover:shadow-lg" 
              onClick={handleUpload}
              disabled={isLoading || !file}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" /> Atualizando Catálogo...
                </>
              ) : (
                <>
                  <UploadCloud size={20} /> Processar e Atualizar Preços
                </>
              )}
            </Button>
          </div>
        </CardContent>
        {isSuccess && (
          <CardFooter className="bg-accent/5 flex flex-col items-center gap-4 py-6 border-t border-accent/20">
            <div className="flex items-center gap-2 text-accent font-bold text-lg">
              <CheckCircle2 size={24} /> Catálogo Atualizado!
            </div>
            <Link href="/admin/products" className="w-full">
              <Button variant="outline" className="w-full h-12 border-accent text-accent hover:bg-accent hover:text-white transition-all group">
                Fazer Amarração de Produtos <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardFooter>
        )}
      </Card>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dicas de Importação</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded text-xs font-bold shrink-0">1</span>
            O sistema identifica produtos iguais pelo **Nome** e **Unidade**.
          </li>
          <li className="flex gap-2">
            <span className="bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded text-xs font-bold shrink-0">2</span>
            Diferenças de maiúsculas, minúsculas ou espaços extras são corrigidas automaticamente.
          </li>
          <li className="flex gap-2">
            <span className="bg-primary/10 text-primary w-5 h-5 flex items-center justify-center rounded text-xs font-bold shrink-0">3</span>
            Se o produto já existir na fábrica, apenas o preço e a data de atualização serão alterados.
          </li>
        </ul>
      </div>
    </div>
  );
}
