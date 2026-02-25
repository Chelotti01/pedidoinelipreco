
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, UploadCloud, Loader2, CheckCircle2, ChevronLeft, AlertCircle } from "lucide-react";
import Link from 'next/link';
import * as XLSX from 'xlsx';

export default function ImportRegisteredProductsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();

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
      // Busca exata
      if (row[key] !== undefined) return row[key];
      // Busca case-insensitive e parcial
      const foundKey = Object.keys(row).find(k => 
        k.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(k.toLowerCase())
      );
      if (foundKey) return row[foundKey];
    }
    return '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "Arquivo não selecionado", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        toast({ title: "Arquivo vazio", description: "O arquivo selecionado não contém dados.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const colRef = collection(db, 'registered_products');
      
      let count = 0;
      for (const row of data as any[]) {
        const productData = {
          status: getRowValue(row, ["Status", "Ativo/Inativo"]) || 'Active',
          brand: getRowValue(row, ["Marca", "Brand"]) || '',
          line: getRowValue(row, ["Linha", "Line"]) || '',
          code: String(getRowValue(row, ["Código", "CÓDIGO", "Code"]) || ''),
          description: getRowValue(row, ["Descrição", "DESCRIÇÃO", "Description"]) || '',
          quantityPerBox: Number(getRowValue(row, ["Qtd Caixa", "Quantidade na caixa", "Quantity"]) || 0),
          unit: getRowValue(row, ["Unidade", "Unit"]) || '',
          ean: String(getRowValue(row, ["EAN", "GTIN"]) || ''),
          dun14: String(getRowValue(row, ["DUN14", "DUN-14"]) || ''),
          taxClassification: getRowValue(row, ["Classificação Fiscal", "Tax Classification"]) || '',
          ncm: getRowValue(row, ["NCM"]) || '',
          cest: getRowValue(row, ["CEST"]) || '',
          unitNetWeightKg: Number(getRowValue(row, ["Peso Liq Unit", "Peso Líquido Unitário (Kg)"]) || 0),
          boxWeightKg: Number(getRowValue(row, ["Peso Caixa", "Peso Caixa (Kg)"]) || 0),
          st: String(getRowValue(row, ["ST"]) || ''),
          factoryId: '', 
          catalogProductId: '', 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        addDocumentNonBlocking(colRef, productData);
        count++;
      }

      setIsSuccess(true);
      toast({ title: "Importação concluída", description: `${count} produtos foram adicionados.` });
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      toast({ title: "Erro na importação", description: "Verifique o formato do arquivo.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-muted-foreground hover:text-primary">
            <ChevronLeft size={28} />
          </Link>
          <h1 className="text-2xl font-bold">Importar Produtos</h1>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="text-primary" size={20} /> Passo 1: Modelo
            </CardTitle>
            <CardDescription>
              Baixe o modelo Excel para ver como organizar os dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full gap-2 border-primary text-primary">
              <FileSpreadsheet size={18} /> Baixar Modelo Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UploadCloud className="text-primary" size={20} /> Passo 2: Upload
            </CardTitle>
            <CardDescription>
              Selecione o arquivo Excel preenchido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="import-file">Arquivo XLSX</Label>
              <Input 
                id="import-file" 
                type="file" 
                accept=".xlsx" 
                onChange={handleFileChange}
                disabled={isLoading}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-accent" />
                  Selecionado: {file.name}
                </p>
              )}
            </div>

            {isSuccess && (
              <div className="p-4 bg-accent/10 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="text-accent mt-0.5" size={20} />
                <div>
                  <p className="font-bold text-accent">Sucesso!</p>
                  <p className="text-sm">Os produtos foram importados. Vá para a lista para vincular os preços do catálogo.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {!isSuccess ? (
              <Button 
                className="w-full h-12 text-lg font-semibold gap-2" 
                onClick={handleUpload}
                disabled={isLoading || !file}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <UploadCloud size={20} />}
                Iniciar Importação
              </Button>
            ) : (
              <Link href="/admin/products" className="w-full">
                <Button variant="outline" className="w-full h-12">
                  Voltar para Produtos
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
