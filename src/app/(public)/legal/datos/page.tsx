import { POLITICA_DATOS } from "@/config/legales";
import { PaginaLegal, metadataLegal } from "../plantilla";

export const metadata = metadataLegal(POLITICA_DATOS);

export default function PaginaPoliticaDatos() {
  return <PaginaLegal documento={POLITICA_DATOS} />;
}
