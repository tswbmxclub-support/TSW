import { TERMINOS } from "@/config/legales";
import { PaginaLegal, metadataLegal } from "../plantilla";

export const metadata = metadataLegal(TERMINOS);

export default function PaginaTerminos() {
  return <PaginaLegal documento={TERMINOS} />;
}
