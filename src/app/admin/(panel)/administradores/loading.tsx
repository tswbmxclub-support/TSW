import { Skeleton, SkeletonFilas } from "@/components/ui";

export default function CargandoAdministradores() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full" />
      <SkeletonFilas filas={2} className="mt-8" />
    </div>
  );
}
