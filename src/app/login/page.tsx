import { PageContainer } from "../layout/PageContainer";
import { LoginForm } from "@/modules/auth/LoginForm";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <PageContainer>
      <div className="mb-6 rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Acceso</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Iniciar sesión</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Accede para registrar entrada, salida y consultar tus horas de biblioteca.
        </p>
      </div>
      <LoginForm redirectPath={resolvedSearchParams?.redirect} />
    </PageContainer>
  );
}
