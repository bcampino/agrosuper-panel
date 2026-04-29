export type Brand = 'LA_CRIANZA' | 'SUPER_CERDO';
export type Space = 'INTERIOR' | 'PANADERIA' | 'FACHADA_EXTERNA';
export type MaterialStatus = 'implemented' | 'not_implemented' | 'pending';

export interface AgrosuperAudit {
  id: string;
  location_id: string;
  location_name: string;
  implementer_name: string;
  submitted_at: string;
  form_number: number;
  company: string;
  phone: string;
  pdf_url?: string;
  status: 'received' | 'calculated';
  implementation_rate: number;
  metrics_by_brand: {
    la_crianza: number;
    super_cerdo: number;
  };
  metrics_by_space: {
    panaderia: number;
    fachada_externa: number;
  };
  created_at: string;
  updated_at: string;
}

export interface AgrosuperMaterial {
  id: string;
  audit_id: string;
  brand: Brand | null;
  space: Space;
  material: string;
  implemented: boolean;
  vende?: boolean;
  tiene_stock?: boolean;
  created_at: string;
}

export interface MaterialBreakdown {
  name: string;
  implemented: number;
  total: number;
  percentage: number;
}

export interface MetricsSummary {
  overall: number;
  by_brand: {
    la_crianza: number;
    super_cerdo: number;
  };
  by_space: {
    panaderia: number;
    fachada_externa: number;
  };
  total_audits: number;
  total_materials: number;
}
