
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, addDocumentNonBlocking, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, UploadCloud, Loader2, CheckCircle2, ChevronLeft, Info } from "lucide-react";
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function ImportRegisteredProductsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();

  // Busca perfil pelo e-mail do usuário
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Status": "Active",
        "Marca": "Marca Exemplo",
        "Linha": "Linha Premium",
        "Código": "PRD001",
        "Descrição": "Produto Exemplo para Venda",
        "Qtd Caixa": 12,
        "Unidade": "PC",
        "EAN": "7891234567890",
        "DUN14": "17891234567897",
        "Classificação Fiscal": "Nacional",
        "NCM": "39241000",
        "CEST": "1400100",
        "Peso Liq Unit": 0.5,
        "Peso Caixa": 6.5,
        "ST": "0%"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_cadastro_produtos.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const getRowValue = (row: any, keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
      
      const foundKey = Object.keys(row).find(k => {
        const normalizedK = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const normalizedTarget = key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        return normalizedK === normalizedTarget || normalizedK.includes(normalizedTarget) || normalizedTarget.includes(normalizedK);
      });
      if (foundKey) return row[foundKey];
    }
    return '';
  };

  const safeNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleUpload = async () => {
    if (!file || !orgId) {
      toast({ title: "Organização não identificada", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (data.length === 0) {
        toast({ title: "Arquivo vazio", description: "O arquivo selecionado não contém dados.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const colRef = collection(db, 'organizations', orgId, 'products');
      
      let count = 0;
      for (const row of data as any[]) {
        const code = String(getRowValue(row, ["Código", "Codigo", "Cód", "Ref", "Code"]) || '');
        const description = String(getRowValue(row, ["Descrição", "Descricao", "Produto", "Item", "Description"]) || '');

        if (!code && !description) continue;

        const productData = {
          organizationId: orgId,
          status: String(getRowValue(row, ["Status", "Ativo", "Situacao"]) || 'Active'),
          brand: String(getRowValue(row, ["Marca", "Fabricante", "Brand"]) || ''),
          line: String(getRowValue(row, ["Linha", "Colecao", "Line"]) || ''),
          code: code || `ID-${Date.now()}-${count}`,
          description: description || 'Sem Descrição',
          quantityPerBox: safeNumber(getRowValue(row, ["Qtd Caixa", "Embalagem", "Quantity", "Cx"])),
          unit: String(getRowValue(row, ["Unidade", "Und", "Unit", "Un"]) || 'UN'),
          ean: String(getRowValue(row, ["EAN", "GTIN", "Barras", "Cod Barras"]) || ''),
          dun14: String(getRowValue(row, ["DUN14", "DUN-14", "DUN"]) || ''),
          taxClassification: String(getRowValue(row, ["Classificação Fiscal", "Classificacao", "Tax", "CF"]) || ''),
          ncm: String(getRowValue(row, ["NCM"]) || ''),
          cest: String(getRowValue(row, ["CEST"]) || ''),
          unitNetWeightKg: safeNumber(getRowValue(row, ["Peso Liq Unit", "Peso Líquido", "Weight", "Peso Liq"])),
          boxWeightKg: safeNumber(getRowValue(row, ["Peso Caixa", "Peso Bruto", "Peso Cx"])),
          st: String(getRowValue(row, ["ST", "Substituicao", "Imposto"]) || '0%'),
          factoryId: '', 
          catalogProductId: '', 
          customSurchargeValue: 0,
          customSurchargeType: 'fixed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        addDocumentNonBlocking(colRef, productData);
        count++;
      }

      setIsSuccess(true);
      toast({ title: "Importação concluída", description: `${count} itens processados para ${orgId}.` });
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      toast({ title: "Erro na importação", description: "Ocorreu um erro ao processar os dados.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronLeft size={28} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-primary">Importação de Produtos</h1>
            <p className="text-muted-foreground text-xs font-bold">Empresa: {orgId || 'Carregando...'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
              <Download className="text-primary" size={18} /> Modelo de Referência
            </CardTitle>
            <CardDescription className="text-xs">
              Baixe o modelo para garantir que os dados sejam importados corretamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full gap-2 border-primary text-primary font-bold">
              <FileSpreadsheet size={18} /> Baixar Modelo Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none">
          <CardHeader className="bg-slate-100 rounded-t-xl">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
              <UploadCloud className="text-primary" size={18} /> Upload da Planilha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="import-file" className="text-xs font-bold uppercase">Arquivo XLSX</Label>
              <Input 
                id="import-file" 
                type="file" 
                accept=".xlsx" 
                onChange={handleFileChange}
                disabled={isLoading}
                className="h-12 border-dashed border-2"
              />
            </div>

            {isSuccess && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 flex items-start gap-3">
                <CheckCircle2 className="text-accent shrink-0" size={20} />
                <div>
                  <p className="font-black text-accent text-xs uppercase">Processamento OK!</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Os produtos foram importados. Agora você deve editá-los para fazer a "Amarração" com o catálogo de preços.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {!isSuccess ? (
              <Button 
                className="w-full h-14 text-lg font-black uppercase gap-2 shadow-lg" 
                onClick={handleUpload}
                disabled={isLoading || !file || !orgId}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <UploadCloud size={20} />}
                Processar Importação
              </Button>
            ) : (
              <Link href="/admin/products" className="w-full">
                <Button variant="outline" className="w-full h-14 font-black uppercase text-accent border-accent hover:bg-accent/5">
                  Ver Produtos e Fazer Amarração
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-bold uppercase">
              <Info size={12} /> Somente arquivos .xlsx são permitidos
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
