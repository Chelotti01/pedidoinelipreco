
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
      // Configura a persistência baseada no "Lembrar de mim"
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      // Mapeamento de usuários conforme solicitado
      let targetEmail = email;
      if (email.toLowerCase() === 'rodrigo') targetEmail = 'vendas.piracanjuba@gmail.com';
      if (email.toLowerCase() === 'adriana') targetEmail = 'adriana@inteli-preco.com';

      await signInWithEmailAndPassword(auth, targetEmail, password);
      
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      
      // Redirecionamento automático baseado no usuário
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto bg-primary w-12 h-12 rounded-xl flex items-center justify-center text-white mb-2">
            <Zap size={28} />
          </div>
          <CardTitle className="text-2xl font-black text-primary">InteliPreço</CardTitle>
          <CardDescription>Acesse o sistema para gerenciar pedidos.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Usuário</Label>
              <Input 
                id="email" 
                placeholder="Rodrigo ou Adriana" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
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
                  className="pr-10"
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
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox 
                id="remember" 
                checked={rememberMe} 
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Lembrar de mim
              </label>
            </div>
          </CardContent>
          <CardFooter className="pt-6">
            <Button className="w-full h-12 text-lg font-bold gap-2" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
              Entrar no Sistema
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
