import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Receipt, AlertCircle } from "lucide-react";
import { getLoginUrl } from "@/const";

const loginSchema = z.object({
  username: z.string().min(1, "กรุณาระบุชื่อผู้ใช้"),
  password: z.string().min(1, "กรุณาระบุรหัสผ่าน"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (err) => {
      setError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    },
  });

  const onSubmit = (data: LoginForm) => {
    setError(null);
    loginMutation.mutate(data);
  };

  const handleManusLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30 mb-4">
            <Receipt className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Expense Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">ระบบบันทึกและติดตามค่าใช้จ่าย</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/80 backdrop-blur shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">เข้าสู่ระบบ</CardTitle>
            <CardDescription className="text-slate-400">
              เลือกวิธีเข้าสู่ระบบที่ต้องการ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Manus OAuth Login Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-600 bg-slate-700/50 hover:bg-slate-600/60 text-white font-medium h-11 gap-3 transition-all duration-150 active:scale-[0.97]"
              onClick={handleManusLogin}
            >
              {/* Manus Logo SVG */}
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="8" fill="#0EA5E9"/>
                <path d="M8 22V10l8 6 8-6v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              เข้าสู่ระบบด้วย Manus
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-3 text-slate-500 tracking-wider">หรือ</span>
              </div>
            </div>

            {/* Username/Password Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-800 bg-red-900/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">
                  ชื่อผู้ใช้
                </Label>
                <Input
                  id="username"
                  placeholder="กรอกชื่อผู้ใช้"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-500"
                  {...register("username")}
                  autoComplete="username"
                />
                {errors.username && (
                  <p className="text-red-400 text-xs">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  รหัสผ่าน
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="กรอกรหัสผ่าน"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-500"
                  {...register("password")}
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="text-red-400 text-xs">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium h-11 transition-all duration-150 active:scale-[0.97]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  "เข้าสู่ระบบด้วย Username"
                )}
              </Button>
            </form>

            {/* Test accounts hint */}
            <div className="mt-2 p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
              <p className="text-xs text-slate-400 font-medium mb-2">บัญชีทดสอบ:</p>
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>admin / Admin@1234</span>
                  <span className="text-amber-400">ผู้ดูแลระบบ</span>
                </div>
                <div className="flex justify-between">
                  <span>user1 / Admin@1234</span>
                  <span className="text-blue-400">ผู้ใช้งาน</span>
                </div>
                <div className="flex justify-between">
                  <span>viewer1 / Admin@1234</span>
                  <span className="text-slate-400">ผู้ชม</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
