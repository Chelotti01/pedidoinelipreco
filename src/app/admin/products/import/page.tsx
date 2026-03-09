
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
import { FileSpreadsheet, Download, UploadCloud, Loader2, CheckCircle2, ChevronLeft, AlertTriangle } from "lucide-react";
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

  // OBRIGATÓRIO: Identificar organização pelo e-mail do usuário
  const userProfileRef = useMemoFirebase(() => 
    user?.email ? doc(db, 'userProfiles', user.email.toLowerCase().trim()) : null
  , [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const orgId = profile?.organizationId;

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Status": "Active",
        "Marca": "EXEMPLO",
        "Linha": "SECA",
        "Código": "12345",
        "Descrição": "PRODUTO TESTE IMPORTAÇÃO",
        "Qtd Caixa": 12,
        "Unidade": "CX",
        "EAN": "7890000000000",
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
    XLSX.writeFile(workbook, "modelo_produtos.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const getRowValue = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    
    // 1. Tenta correspondência EXATA primeiro (case insensitive e sem acentos)
    for (const key of keys) {
      const target = key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
      const foundKey = rowKeys.find(k => {
        const normalizedK = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        return normalizedK === target;
      });
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        return row[foundKey];
      }
    }

    // 2. Fallback para inclusão parcial (apenas se o termo for longo para evitar colisões)
    for (const key of keys) {
      const target = key.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
      if (target.length < 3) continue;

      const foundKey = rowKeys.find(k => {
        const normalizedK = k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        return normalizedK.includes(target);
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
      toast({ title: "Erro", description: "Organização não identificada ou arquivo não selecionado.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      const colRef = collection(db, 'organizations', orgId, 'products');
      let count = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        const rowArray = rawData[i + 1] || []; // i+1 porque rawData[0] são os cabeçalhos

        const code = String(getRowValue(row, ["Código", "Codigo", "Cód", "Ref"]) || '').trim();
        const description = String(getRowValue(row, ["Descrição", "Descricao", "Produto", "Item"]) || '').trim();

        if (!code && !description) continue;

        // Normalização do Status (Mapeia Ativo para Active)
        const rawStatus = String(getRowValue(row, ["Status", "Ativo", "Situacao"]) || 'Active').trim().toLowerCase();
        const normalizedStatus = (rawStatus === 'ativo' || rawStatus === 'active') ? 'Active' : 
                                 (rawStatus === 'inativo' || rawStatus === 'inactive') ? 'Inactive' : 'Active';

        // Qtd/Caixa: Busca na COLUNA F (index 5) se o nome do cabeçalho falhar
        let qtyValue = safeNumber(getRowValue(row, ["Qtd Caixa", "Embalagem", "Quantity", "Cx", "Qtd/Caixa"]));
        if (!qtyValue && rowArray[5] !== undefined && rowArray[5] !== '') {
          qtyValue = safeNumber(rowArray[5]);
        }

        // ST: Busca na COLUNA O (index 14) para evitar colisão com "Status"
        let stValue = String(getRowValue(row, ["ST", "Substituicao", "Imposto"]) || '').trim();
        if (!stValue || stValue.toLowerCase() === 'ativo' || stValue.toLowerCase() === 'active') {
          if (rowArray[14] !== undefined && rowArray[14] !== '') {
            stValue = String(rowArray[14]).trim();
          } else {
            stValue = '0%';
          }
        }

        const productData = {
          organizationId: orgId,
          status: normalizedStatus,
          brand: String(getRowValue(row, ["Marca", "Fabricante", "Brand"]) || '').trim().toUpperCase(),
          line: String(getRowValue(row, ["Linha", "Colecao", "Line"]) || '').trim().toUpperCase(),
          code: code,
          description: description.toUpperCase(),
          quantityPerBox: qtyValue,
          unit: String(getRowValue(row, ["Unidade", "Und", "Unit", "Un"]) || 'UN').trim().toUpperCase(),
          ean: String(getRowValue(row, ["EAN", "GTIN", "Barras", "Cod Barras"]) || '').trim(),
          dun14: String(getRowValue(row, ["DUN14", "DUN-14", "DUN"]) || '').trim(),
          taxClassification: String(getRowValue(row, ["Classificação Fiscal", "Classificacao", "Tax", "CF"]) || '').trim(),
          ncm: String(getRowValue(row, ["NCM", "NCM/SH"]) || '').trim(),
          cest: String(getRowValue(row, ["CEST"]) || '').trim(),
          unitNetWeightKg: safeNumber(getRowValue(row, ["Peso Liq Unit", "Peso Líquido", "Weight", "Peso Liq", "Peso Líq. Unit"])),
          boxWeightKg: safeNumber(getRowValue(row, ["Peso Caixa", "Peso Bruto", "Peso Cx", "Peso Caixa (Kg)"])),
          st: stValue,
          factoryId: 'none', 
          catalogProductId: 'none', 
          customSurchargeValue: 0,
          customSurchargeType: 'fixed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        addDocumentNonBlocking(colRef, productData);
        count++;
      }

      setIsSuccess(true);
      toast({ title: "Importação concluída", description: `${count} produtos importados para ${orgId}.` });
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      toast({ title: "Erro na importação", variant: "destructive" });
    }
  };

  if (isProfileLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validando Perfil SaaS...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/admin/products" className="text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft size={28} />
        </Link>
        <h1 className="text-2xl font-black uppercase text-primary tracking-tight">Importar Ficha Técnica ({orgId || '...'})</h1>
      </div>

      {!orgId && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
          <AlertTriangle size={20} />
          <p className="text-xs font-bold uppercase">Erro: Usuário não vinculado a uma organização.</p>
        </div>
      )}

      <div className="grid gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
              <Download className="text-primary" size={18} /> Modelo Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full gap-2 border-primary text-primary font-bold hover:bg-primary/10">
              <FileSpreadsheet size={18} /> Baixar Modelo para Importação
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none">
          <CardHeader className="bg-slate-100">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-700">
              <UploadCloud className="text-primary" size={18} /> Upload da Planilha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid w-full items-center gap-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Selecione o arquivo XLSX</Label>
              <Input type="file" accept=".xlsx" onChange={handleFileChange} disabled={isLoading} className="h-12 border-dashed border-2 cursor-pointer" />
            </div>
            {isSuccess && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                <p className="text-[10px] text-emerald-800 uppercase font-bold leading-relaxed">
                  Importação concluída para <strong>{orgId}</strong>! Vá para a lista para realizar a amarração de preços.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {!isSuccess ? (
              <Button className="w-full h-14 text-lg font-black uppercase gap-2 shadow-lg" onClick={handleUpload} disabled={isLoading || !file || !orgId}>
                {isLoading ? <Loader2 className="animate-spin" /> : <UploadCloud size={20} />} Processar Planilha
              </Button>
            ) : (
              <Link href="/admin/products" className="w-full">
                <Button variant="outline" className="w-full h-14 font-black uppercase text-emerald-700 border-emerald-600 hover:bg-emerald-50">Ver Lista de Produtos</Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
