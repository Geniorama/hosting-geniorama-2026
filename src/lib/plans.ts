export type PlanCategory = "web" | "ads";

export type PlanFeature = {
  strong?: string;
  text?: string;
};

export type Plan = {
  id: string;
  name: string;
  eyebrow: string;
  tagline: string;
  featured?: boolean;
  badge?: string;
  image?: string;
  imagePosition?: string;
  price: {
    monthly: number;
    annual: number;
    original: number;
  };
  features: PlanFeature[];
};

export const plans: Record<PlanCategory, Plan[]> = {
  web: [
    {
      id: "starter",
      name: "Starter",
      eyebrow: "Hosting Web",
      tagline: "Para sitios pequeños y proyectos personales que están comenzando.",
      image: "/images/plan-starter.jpg",
      price: { monthly: 15000, annual: 144000, original: 180000 },
      features: [
        { strong: "1 GB", text: "almacenamiento SSD" },
        { strong: "1 GB", text: "ancho de banda mensual" },
        { strong: "3", text: "cuentas de email (250 MB c/u)" },
        { strong: "1", text: "base de datos MySQL" },
        { strong: "1 dominio", text: "+ 3 subdominios" },
        { text: "cPanel · WordPress · Joomla" },
      ],
    },
    {
      id: "basic",
      name: "Basic",
      eyebrow: "Hosting Web",
      tagline: "Sitios institucionales o blogs con tráfico moderado.",
      image: "/images/plan-basic.jpg",
      price: { monthly: 20000, annual: 192000, original: 240000 },
      features: [
        { strong: "3 GB", text: "almacenamiento SSD" },
        { strong: "2 GB", text: "ancho de banda mensual" },
        { strong: "5", text: "cuentas de email (250 MB c/u)" },
        { strong: "3", text: "bases de datos MySQL" },
        { strong: "2 dominios", text: "+ 5 subdominios" },
        { text: "cPanel · WordPress · Joomla" },
      ],
    },
    {
      id: "standar",
      name: "Standard",
      eyebrow: "Más popular",
      tagline: "El equilibrio ideal entre rendimiento y precio para PYMES.",
      featured: true,
      badge: "Recomendado",
      image: "/images/cover-plan-standard.webp",
      imagePosition: "top",
      price: { monthly: 25000, annual: 240000, original: 300000 },
      features: [
        { strong: "10 GB", text: "almacenamiento SSD" },
        { strong: "20 GB", text: "ancho de banda mensual" },
        { strong: "10", text: "cuentas de email (1 GB c/u)" },
        { strong: "2", text: "bases de datos MySQL" },
        { strong: "2 dominios", text: "+ 5 subdominios" },
        { text: "cPanel · WordPress · Joomla · PrestaShop" },
      ],
    },
    {
      id: "news",
      name: "News / Shop",
      eyebrow: "Hosting Web",
      tagline: "Para portales de noticias y tiendas con catálogos medianos.",
      image: "/images/plan-news.jpg",
      price: { monthly: 80000, annual: 768000, original: 960000 },
      features: [
        { strong: "20 GB", text: "almacenamiento SSD" },
        { strong: "120 GB", text: "ancho de banda mensual" },
        { strong: "10", text: "cuentas de email (500 MB c/u)" },
        { strong: "10", text: "bases de datos MySQL" },
        { strong: "3 dominios", text: "+ 5 subdominios" },
        { text: "cPanel · WordPress · Joomla · PrestaShop" },
      ],
    },
    {
      id: "mega",
      name: "Mega Shop / News",
      eyebrow: "Alto rendimiento",
      tagline: "E-commerce y medios con alto volumen de tráfico.",
      image: "/images/plan-mega.jpg",
      price: { monthly: 100000, annual: 960000, original: 1200000 },
      features: [
        { strong: "40 GB", text: "almacenamiento SSD" },
        { strong: "200 GB", text: "ancho de banda mensual" },
        { strong: "10", text: "cuentas de email (1 GB c/u)" },
        { strong: "10", text: "bases de datos MySQL" },
        { strong: "3 dominios", text: "+ 5 subdominios" },
        { text: "cPanel · WordPress · Joomla · PrestaShop" },
      ],
    },
  ],
  ads: [
    {
      id: "ads-basic",
      name: "Ads Basic",
      eyebrow: "Hosting Ads",
      tagline: "Para campañas de tráfico bajo y medio con landing simple.",
      image: "/images/plan-ads-basic.jpg",
      price: { monthly: 40000, annual: 384000, original: 480000 },
      features: [
        { strong: "2 GB", text: "almacenamiento SSD" },
        { strong: "50 GB", text: "ancho de banda mensual" },
        { strong: "5", text: "cuentas de email (500 MB c/u)" },
        { strong: "2", text: "bases de datos MySQL" },
        { strong: "3 dominios", text: "+ 3 subdominios" },
        { text: "Optimizado para tráfico pago" },
      ],
    },
    {
      id: "ads-landing",
      name: "Ads Landing",
      eyebrow: "Más popular",
      tagline: "Landing pages con tráfico sostenido y conversión optimizada.",
      featured: true,
      badge: "Recomendado",
      image: "/images/plan-ads-landing.jpg",
      price: { monthly: 60000, annual: 576000, original: 720000 },
      features: [
        { strong: "2 GB", text: "almacenamiento SSD" },
        { strong: "100 GB", text: "ancho de banda mensual" },
        { strong: "3", text: "cuentas de email (250 MB c/u)" },
        { strong: "2", text: "bases de datos MySQL" },
        { strong: "1 dominio", text: "+ 2 subdominios" },
        { text: "Optimizado para velocidad de carga" },
      ],
    },
    {
      id: "ads-advanced",
      name: "Ads Advanced",
      eyebrow: "Alto tráfico",
      tagline: "Campañas masivas con alto volumen de impresiones simultáneas.",
      image: "/images/plan-ads-advanced.jpg",
      price: { monthly: 80000, annual: 768000, original: 960000 },
      features: [
        { strong: "4 GB", text: "almacenamiento SSD" },
        { strong: "200 GB", text: "ancho de banda mensual" },
        { strong: "10", text: "cuentas de email (500 MB c/u)" },
        { strong: "2", text: "bases de datos MySQL" },
        { strong: "2 dominios", text: "+ 5 subdominios" },
        { text: "Capacidad para múltiples campañas" },
      ],
    },
  ],
};

export type CompareData = {
  headers: string[];
  featuredCol: number;
  rows: string[][];
};

export const compareData: Record<PlanCategory, CompareData> = {
  web: {
    headers: ["", "Starter", "Basic", "Standard", "News/Shop", "Mega"],
    featuredCol: 3,
    rows: [
      ["Almacenamiento SSD", "1 GB", "3 GB", "10 GB", "20 GB", "40 GB"],
      ["Ancho de banda mensual", "1 GB", "2 GB", "20 GB", "120 GB", "200 GB"],
      ["Cuentas de email", "3", "5", "10", "10", "10"],
      ["Capacidad por cuenta", "250 MB", "250 MB", "1 GB", "500 MB", "1 GB"],
      ["Bases de datos MySQL", "1", "3", "2", "10", "10"],
      ["Dominios permitidos", "1", "2", "2", "3", "3"],
      ["Subdominios", "3", "5", "5", "5", "5"],
      ["cPanel", "✓", "✓", "✓", "✓", "✓"],
      ["Instaladores", "WP/Joomla", "WP/Joomla", "WP/Joomla/PS", "WP/Joomla/PS", "WP/Joomla/PS"],
    ],
  },
  ads: {
    headers: ["", "Ads Basic", "Ads Landing", "Ads Advanced"],
    featuredCol: 2,
    rows: [
      ["Almacenamiento SSD", "2 GB", "2 GB", "4 GB"],
      ["Ancho de banda mensual", "50 GB", "100 GB", "200 GB"],
      ["Cuentas de email", "5", "3", "10"],
      ["Capacidad por cuenta", "500 MB", "250 MB", "500 MB"],
      ["Bases de datos MySQL", "2", "2", "2"],
      ["Dominios permitidos", "3", "1", "2"],
      ["Subdominios", "3", "2", "5"],
      ["cPanel", "✓", "✓", "✓"],
      ["Instaladores", "WP/Joomla/PS", "WP/Joomla/PS", "WP/Joomla/PS"],
    ],
  },
};
