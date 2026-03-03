
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, LogIn, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      let targetEmail = email;
      // Mapeamento simplificado para facilitar o uso no dia a dia
      const lowerEmail = email.toLowerCase().trim();
      if (lowerEmail === 'rodrigo') targetEmail = 'vendas.piracanjuba@gmail.com';
      if (lowerEmail === 'adriana') targetEmail = 'adriana@inteli-preco.com';
      if (lowerEmail === 'demo') targetEmail = 'demo@inteli-preco.com';

      await signInWithEmailAndPassword(auth, targetEmail, password);
      
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      
      if (targetEmail === 'adriana@inteli-preco.com') {
        router.push('/orders/new');
      } else {
        router.push('/');
      }
    } catch (error: any) {
      console.error(error);
      toast({ 
        title: "Erro de login", 
        description: "Usuário ou senha inválidos.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto bg-primary w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
            <Zap size={32} fill="white" />
          </div>
          <CardTitle className="text-3xl font-black text-primary">InteliPreço</CardTitle>
          <CardDescription>Acesso restrito ao sistema de pedidos.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Usuário</Label>
              <Input 
                id="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: rodrigo, adriana ou demo"
                className="h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="pr-10 h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe} 
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none cursor-pointer select-none"
              >
                Manter conectado
              </label>
            </div>
          </CardContent>
          <CardFooter className="pt-6">
            <Button className="w-full h-14 text-lg font-bold gap-2 shadow-lg" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              Entrar no Sistema
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
