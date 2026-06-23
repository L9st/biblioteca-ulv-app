"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/app/cards/StatCard";
import {
  buildAttendanceByLibraryChart,
  buildDailyActivityChart,
  buildHoursByLibraryChart,
  buildReportSummary,
  buildReservationsByStatusChart,
  buildTopReservedSpacesChart,
  formatMinutes,
  type ReportChartData,
} from "@/services/admin-reports.service";

const ULV_BLUE = "#06426a";
const ULV_YELLOW = "#fac600";
const ULV_BG = "#f9f9f9";
const SOFT_BLUE = "#dbeafe";
const SOFT_GRAY = "#e5e7eb";

type AdminReportChartsProps = {
  data: ReportChartData | null;
  isLoading: boolean;
  error: string | null;
};

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="w-full max-w-full overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="mb-4 text-lg font-black text-ulv-blue">{title}</h3>
      <div className="h-[300px] w-full max-w-full">{children}</div>
    </section>
  );
}

export function AdminReportCharts({ data, isLoading, error }: AdminReportChartsProps) {
  if (isLoading) {
    return <p className="rounded-2xl bg-white p-5 text-sm font-bold text-slate-600 shadow-sm">Cargando gráficos...</p>;
  }

  if (error) {
    return <p className="rounded-2xl bg-red-50 p-5 text-sm font-bold text-red-800">No se pudieron cargar los gráficos. {error}</p>;
  }

  if (!data || (data.attendanceLogs.length === 0 && data.reservations.length === 0)) {
    return <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-slate-500 shadow-sm">No hay datos suficientes para graficar.</p>;
  }

  const summary = buildReportSummary(data.attendanceLogs);
  const attendanceByLibrary = buildAttendanceByLibraryChart(data.attendanceLogs);
  const hoursByLibrary = buildHoursByLibraryChart(data.attendanceLogs);
  const reservationsByStatus = buildReservationsByStatusChart(data.reservations);
  const topSpaces = buildTopReservedSpacesChart(data.reservations, 5);
  const dailyActivity = buildDailyActivityChart(data);
  const pendingReservations = data.reservations.filter((reservation) => reservation.status === "pending").length;
  const approvedReservations = data.reservations.filter((reservation) => reservation.status === "approved").length;
  const pieColors = [ULV_YELLOW, ULV_BLUE, "#fca5a5", SOFT_GRAY, "#86efac"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total de asistencias" value={String(summary.totalLogs)} detail="Registros filtrados" />
        <StatCard label="Total de horas" value={summary.totalHoursText} detail="Solo cerradas" />
        <StatCard label="Usuarios únicos" value={String(summary.uniqueUsers)} detail="Con actividad" />
        <StatCard label="Reservas totales" value={String(data.reservations.length)} detail="Filtradas" />
        <StatCard label="Reservas pendientes" value={String(pendingReservations)} detail="Por revisar" />
        <StatCard label="Reservas aprobadas" value={String(approvedReservations)} detail="Confirmadas" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Asistencia por biblioteca">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceByLibrary} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ULV_BG} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [value, "Registros"]} />
              <Bar dataKey="value" fill={ULV_BLUE} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Horas registradas por biblioteca">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hoursByLibrary} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ULV_BG} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value} h`, "Horas"]} />
              <Bar dataKey="value" fill={ULV_YELLOW} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Reservas por estado">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={reservationsByStatus} dataKey="value" nameKey="name" innerRadius={58} outerRadius={95} paddingAngle={3}>
                {reservationsByStatus.map((entry, index) => <Cell key={entry.name} fill={pieColors[index] ?? SOFT_BLUE} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Espacios más reservados">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topSpaces} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ULV_BG} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [value, "Reservas"]} />
              <Bar dataKey="value" fill={ULV_BLUE} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="w-full max-w-full overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h3 className="mb-4 text-lg font-black text-ulv-blue">Actividad por día</h3>
          <div className="h-[320px] w-full max-w-full">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={dailyActivity} margin={{ top: 10, right: 15, left: -20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ULV_BG} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-18} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="attendance" name="Asistencias" stroke={ULV_BLUE} strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="reservations" name="Reservas" stroke={ULV_YELLOW} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-black text-ulv-blue">Lectura rápida</h3>
          <div className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
            <p className="rounded-2xl bg-slate-50 p-3">Tiempo acumulado: <span className="font-black text-ulv-blue">{formatMinutes(summary.totalMinutes)}</span></p>
            <p className="rounded-2xl bg-slate-50 p-3">Bibliotecas con actividad: <span className="font-black text-ulv-blue">{attendanceByLibrary.length}</span></p>
            <p className="rounded-2xl bg-slate-50 p-3">Espacios reservados: <span className="font-black text-ulv-blue">{topSpaces.length}</span></p>
          </div>
        </section>
      </div>
    </div>
  );
}
