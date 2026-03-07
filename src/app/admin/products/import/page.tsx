
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

  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Status": "Active",
        "Marca": "PIRACANJUBA",
        "Linha": "SECA",
        "Código": "272807",
        "Descrição": "ALIM AMENDOA...",
        "Qtd Caixa": 12,
        "Unidade": "CX",
        "EAN": "7898215157175",
        "DUN14": "",
        "NCM": "21069090",
        "CEST": "",
        "Peso Liq Unit": 1.0,
        "Peso Caixa": 12.5,
        "ST": "0%"
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_ficha_tecnica.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const getRowValue = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const foundKey = rowKeys.find(k => {
        const normalizedK = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const normalizedTarget = key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        return normalizedK === normalizedTarget || normalizedK.includes(normalizedTarget);
      });
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
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
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const colRef = collection(db, 'organizations', orgId, 'products');
      let count = 0;

      for (const row of data as any[]) {
        const code = String(getRowValue(row, ["Código", "Codigo", "Cód", "Ref"]) || '');
        const description = String(getRowValue(row, ["Descrição", "Descricao", "Produto", "Item"]) || '');

        if (!code && !description) continue;

        const productData = {
          organizationId: orgId,
          status: String(getRowValue(row, ["Status", "Ativo", "Situacao"]) || 'Active'),
          brand: String(getRowValue(row, ["Marca", "Fabricante", "Brand"]) || ''),
          line: String(getRowValue(row, ["Linha", "Colecao", "Line"]) || ''),
          code: code || `ID-${count}`,
          description: description || 'Sem Descrição',
          quantityPerBox: safeNumber(getRowValue(row, ["Qtd Caixa", "Embalagem", "Quantity", "Cx", "Qtd/Caixa"])),
          unit: String(getRowValue(row, ["Unidade", "Und", "Unit", "Un"]) || 'UN'),
          ean: String(getRowValue(row, ["EAN", "GTIN", "Barras", "Cod Barras"]) || ''),
          dun14: String(getRowValue(row, ["DUN14", "DUN-14", "DUN"]) || ''),
          taxClassification: String(getRowValue(row, ["Classificação Fiscal", "Classificacao", "Tax", "CF"]) || ''),
          ncm: String(getRowValue(row, ["NCM", "NCM/SH"]) || ''),
          cest: String(getRowValue(row, ["CEST"]) || ''),
          unitNetWeightKg: safeNumber(getRowValue(row, ["Peso Liq Unit", "Peso Líquido", "Weight", "Peso Liq", "Peso Líq. Unit"])),
          boxWeightKg: safeNumber(getRowValue(row, ["Peso Caixa", "Peso Bruto", "Peso Cx", "Peso Caixa (Kg)"])),
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
      toast({ title: "Importação concluída", description: `${count} produtos técnicos processados.` });
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      toast({ title: "Erro na importação", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/admin/products" className="text-muted-foreground hover:text-primary"><ChevronLeft size={28} /></Link>
        <h1 className="text-2xl font-black uppercase text-primary">Importar Ficha Técnica</h1>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
              <Download className="text-primary" size={18} /> Modelo Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full gap-2 border-primary text-primary font-bold">
              <FileSpreadsheet size={18} /> Baixar Modelo para Ficha Técnica
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none">
          <CardHeader className="bg-slate-100">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
              <UploadCloud className="text-primary" size={18} /> Upload da Planilha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid w-full items-center gap-2">
              <Label className="text-xs font-bold uppercase">Arquivo XLSX</Label>
              <Input type="file" accept=".xlsx" onChange={handleFileChange} disabled={isLoading} className="h-12 border-dashed border-2" />
            </div>
            {isSuccess && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20 flex items-start gap-3">
                <CheckCircle2 className="text-accent shrink-0" size={20} />
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Produtos importados com sucesso! Agora você deve editá-los para vincular ao catálogo de preços.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {!isSuccess ? (
              <Button className="w-full h-14 text-lg font-black uppercase gap-2 shadow-lg" onClick={handleUpload} disabled={isLoading || !file || !orgId}>
                {isLoading ? <Loader2 className="animate-spin" /> : <UploadCloud size={20} />} Processar Ficha Técnica
              </Button>
            ) : (
              <Link href="/admin/products" className="w-full">
                <Button variant="outline" className="w-full h-14 font-black uppercase text-accent border-accent">Voltar para Produtos</Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
