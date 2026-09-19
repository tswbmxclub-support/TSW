import { Contenedor, Skeleton, SkeletonHero } from "@/components/ui";

export default function CargandoCarrito() {
  return (
    <>
      <SkeletonHero />
      <Contenedor className="py-12 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </Contenedor>
    </>
  );
}
