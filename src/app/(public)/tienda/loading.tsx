import { Contenedor, Skeleton, SkeletonFilas, SkeletonHero } from "@/components/ui";

export default function CargandoTienda() {
  return (
    <>
      <SkeletonHero />
      <Contenedor className="py-12 sm:py-16 lg:py-20">
        <Skeleton className="h-11 w-64" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
        <SkeletonFilas filas={2} className="mt-10" />
      </Contenedor>
    </>
  );
}
