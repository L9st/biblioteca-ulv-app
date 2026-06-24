import { PageContainer } from "@/app/layout/PageContainer";
import { AdminUsersPanel } from "@/modules/admin/AdminUsersPanel";

export default function AdminUsuariosPage() {
  return (
    <PageContainer>
      <div className="mb-6 rounded-[2rem] bg-ulv-blue p-5 text-white shadow-sm md:p-8">
        <p className="text-sm font-bold text-ulv-yellow">Panel bibliotecario</p>
        <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">Administración de usuarios</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          Gestiona usuarios, roles, estados de acceso y bibliotecas asignadas al personal.
        </p>
      </div>
      <AdminUsersPanel />
    </PageContainer>
  );
}
