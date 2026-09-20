import { Skeleton, SkeletonTexto } from "@/components/ui";

export default function CargandoCuenta() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-32 w-full max-w-2xl" />
      <Skeleton className="h-36 w-full max-w-xl" />
      <SkeletonTexto lineas={3} />
    </div>
  );
}
