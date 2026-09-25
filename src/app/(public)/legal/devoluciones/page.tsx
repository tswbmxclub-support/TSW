import { DEVOLUCIONES } from "@/config/legales";
import { PaginaLegal, metadataLegal } from "../plantilla";

export const metadata = metadataLegal(DEVOLUCIONES);

export default function PaginaDevoluciones() {
  return <PaginaLegal documento={DEVOLUCIONES} />;
}
