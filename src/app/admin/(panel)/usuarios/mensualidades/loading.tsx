import { Skeleton, SkeletonFilas } from "@/components/ui";

export default function CargandoMensualidadesDelMes() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full" />
      <Skeleton className="mt-8 h-11 w-full max-w-lg" />
      <SkeletonFilas filas={4} className="mt-8" />
    </div>
  );
}
