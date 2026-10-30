export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  sale_price_cents?: number;
  sku?: string;
  image: string;
  featured?: boolean;
  is_active?: boolean;
  stock: number;
  variations?: string[];
};

export const categories = [
  'Brincos',
  'Colares',
  'Anéis',
  'Pulseiras',
  'Conjuntos',
  'Tornozeleiras',
  'Pingentes',
  'Lançamentos',
  'Promoções',
];

export const products: Product[] = [
  {
    id: 'p1',
    slug: 'brinco-argola-dourado',
    name: 'Brinco Árgola Dourado',
    description: 'Brinco em dourado com acabamento delicado para uso diário ou em ocasiões especiais.',
    category: 'Brincos',
    price_cents: 9900,
    sale_price_cents: 8900,
    sku: 'BRI-001',
    image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=80',
    featured: true,
    is_active: true,
    stock: 12,
    variations: ['Dourado', 'Prata', 'Rosa'],
  },
  {
    id: 'p2',
    slug: 'colar-porta-luz',
    name: 'Colar Porta de Luz',
    description: 'Peça sofisticada com brilho discreto e modelagem elegante para compor o visual.',
    category: 'Colares',
    price_cents: 12900,
    sku: 'COL-014',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80',
    featured: true,
    is_active: true,
    stock: 8,
    variations: ['Longo', 'Curto'],
  },
  {
    id: 'p3',
    slug: 'anel-rose-gold',
    name: 'Anel Rose Gold',
    description: 'Anel com toque feminino e acabamento premium em tom rosado sofisticado.',
    category: 'Anéis',
    price_cents: 7900,
    sku: 'ANE-003',
    image: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80',
    featured: false,
    is_active: true,
    stock: 14,
    variations: ['Tamanho 16', 'Tamanho 17', 'Tamanho 18'],
  },
  {
    id: 'p4',
    slug: 'pulseira-estrela',
    name: 'Pulseira Estrela',
    description: 'Pulseira leve, delicada e moderna com acabamento que valoriza o look do dia a dia.',
    category: 'Pulseiras',
    price_cents: 6500,
    sale_price_cents: 5900,
    sku: 'PUL-009',
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80',
    featured: true,
    is_active: true,
    stock: 9,
    variations: ['Média', 'Grande'],
  },
  {
    id: 'p5',
    slug: 'conjunto-madu',
    name: 'Conjunto Madu',
    description: 'Conjunto com peças coordenadas para um visual elegante e equilibrado.',
    category: 'Conjuntos',
    price_cents: 18900,
    sku: 'CON-021',
    image: 'https://images.unsplash.com/photo-1601821765780-3bf2d00d7f4b?auto=format&fit=crop&w=900&q=80',
    featured: true,
    is_active: true,
    stock: 5,
    variations: ['Conjunto rose', 'Conjunto dourado'],
  },
  {
    id: 'p6',
    slug: 'tornozeleira-prata',
    name: 'Tornozeleira Prata',
    description: 'Tornozeleira com detalhe refinado e ajuste confortável para uso diário.',
    category: 'Tornozeleiras',
    price_cents: 7100,
    sku: 'TOR-008',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    featured: false,
    is_active: true,
    stock: 11,
    variations: ['Pequena', 'Média'],
  },
];
