
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, LogIn, Eye, EyeOff, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  const auth = useAuth();
  const db = useFirestore();
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Senhas divergentes", description: "A confirmação de senha deve ser idêntica.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verificar se o e-mail está pré-cadastrado em userProfiles
      const q = query(collection(db, 'userProfiles'), where('email', '==', email.toLowerCase().trim()), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ 
          title: "E-mail não autorizado", 
          description: "Este e-mail não foi convidado para o sistema. Entre em contato com o administrador.", 
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }

      // 2. Criar conta no Auth
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      toast({ title: "Conta ativada!", description: "Sua conta foi criada com sucesso." });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      let msg = "Ocorreu um erro ao criar sua conta.";
      if (error.code === 'auth/email-already-in-use') msg = "Este e-mail já possui uma conta ativa.";
      if (error.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
      
      toast({ title: "Erro no cadastro", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden">
        <CardHeader className="text-center space-y-1 pb-2">
          <div className="mx-auto bg-primary w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
            <Zap size={32} fill="white" />
          </div>
          <CardTitle className="text-3xl font-black text-primary">InteliPreço</CardTitle>
          <CardDescription>Sistema Inteligente de Pedidos</CardDescription>
        </CardHeader>

        <div className="px-6">
          <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Ativar Conta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="pt-4">
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Usuário ou E-mail</Label>
                    <Input 
                      id="email" 
                      type="text"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
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
                        placeholder="••••••"
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
                  <Button className="w-full h-14 text-lg font-bold gap-2 shadow-lg mt-4" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
                    Entrar
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="pt-4">
              <form onSubmit={handleSignUp}>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                    <p className="text-[11px] text-blue-700 font-medium">
                      Nota: Você só pode ativar sua conta se o seu e-mail foi pré-autorizado pelo administrador da organização.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail Autorizado</Label>
                    <Input 
                      id="signup-email" 
                      type="email"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="O mesmo e-mail do convite"
                      className="h-12"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Defina sua Senha</Label>
                    <Input 
                      id="signup-password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="h-12"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirme a Senha</Label>
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      value={confirmPassword} 
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="h-12"
                      required
                    />
                  </div>
                  <Button className="w-full h-14 text-lg font-bold gap-2 shadow-lg mt-4 bg-accent hover:bg-accent/90" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
                    Ativar Minha Conta
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        
        <CardFooter className="pt-6 pb-8 justify-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
            Acesso Restrito
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
