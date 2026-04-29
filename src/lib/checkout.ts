export type PersonType = "natural" | "juridica";

export type DocType = "CC" | "CE" | "NIT" | "PASAPORTE";

export const docTypeOptions: { value: DocType; label: string }[] = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "PASAPORTE", label: "Pasaporte" },
];

export const departments = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

export type CheckoutPayload = {
  planId: string;
  billing: "monthly" | "annual";
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  invoice: {
    personType: PersonType;
    docType: DocType;
    docNumber: string;
    dv?: string;
    legalName: string;
    fiscalResponsibility?: string;
    address: string;
    city: string;
    department: string;
    country: string;
  };
  notes?: string;
};

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
