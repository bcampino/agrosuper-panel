export type UserRole = 'treid_admin' | 'treid_operations' | 'treid_implementador' | 'treid_mystery' | 'enex_admin' | 'enex_jz' | 'enex_seller'

export type AuditType = 'audit' | 'mystery'
export type AuditStatus = 'pending' | 'accepted' | 'rejected' | 'pending_review' | 'pre_aprobado' | 'pre_rechazado' | 'aprobado' | 'rechazado'
export type ReviewVerdict = 'aprobado' | 'pre_aprobado' | 'pre_rechazado' | 'rechazado'
export interface ReviewItem { label: string; passed: boolean; note?: string }
export interface AuditReview {
  id: string
  audit_id: string
  verdict: ReviewVerdict
  confidence: number
  review_items: ReviewItem[]
  summary: string | null
  reviewed_by_ai: boolean
  reviewer_id: string | null
  reviewer_name: string | null
  reviewed_at: string
  reviewer_note: string | null
  created_at: string
}
export type AnswerDecision = 'accepted' | 'edited' | 'rejected'
export type CampaignStatus = 'solicitud' | 'por_validar' | 'por_implementar' | 'ejecutandose' | 'ejecutado' | 'cancelada'
export type OpportunityStatus = 'por_validar' | 'por_ejecutar' | 'archivada' | 'ejecutada' | 'cancelada'
export type MovementType = 'entry' | 'exit'
export type LogisticsRequestStatus = 'por_validar' | 'por_enviar' | 'en_camino' | 'entregada' | 'instalada' | 'cancelada'
export type AiEvidenceType = 'photo' | 'audio'
export type ListCategory = 'material_type' | 'opportunity_type' | 'campaign_type' | 'exit_reason' | 'location_status'
export type StaffType = 'vendedor' | 'jefe_zona' | 'gestor_treid'
export type NoteType = 'general' | 'opportunity' | 'message' | 'material_request'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  zone_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Zone {
  id: string
  name: string
  region: string | null
  created_at: string
}

export interface Location {
  id: string
  code: string
  name: string
  address: string | null
  seller_id: string | null
  jz_id: string | null
  zone_id: string | null
  region: string | null
  city: string | null
  sa_status: boolean
  category: string | null
  subsegment: string | null
  size: string | null
  is_active: boolean
  latitude: number | null
  longitude: number | null
  datascope_id: string | null
  created_at: string
  updated_at: string
  staff_vendedor_id: string | null
  staff_jz_id: string | null
  staff_gestor_id: string | null
  status: string | null
  // Joined
  seller?: User
  jz?: User
  zone?: Zone
  staff_vendedor?: Staff
  staff_jz?: Staff
  staff_gestor?: Staff
}

export interface PillarTree {
  id: string
  version: number
  name: string
  is_active: boolean
  created_at: string
  created_by: string | null
  pillars?: Pillar[]
}

export interface Pillar {
  id: string
  tree_id: string
  name: string
  weight: number
  sort_order: number
  created_at: string
  questions?: Question[]
}

export type QuestionType = 'multi_option' | 'number' | 'photo' | 'text' | 'price_comparison'

export interface Question {
  id: string
  pillar_id: string
  identifier: string
  title: string
  description: string | null
  weight: number
  is_mandatory: boolean
  sort_order: number
  datascope_question_name: string | null
  datascope_question_id: number | null
  question_type: QuestionType
  price_pair_group: string | null
  evidence_photo_ids: number[] | null
  ai_enabled: boolean
  ai_evidence_type: AiEvidenceType
  ai_instruction: string | null
  created_at: string
  options?: QuestionOption[]
}

export interface QuestionOption {
  id: string
  question_id: string
  label: string
  value: number
  datascope_value: string | null
  sort_order: number
}

export interface Audit {
  id: string
  location_id: string
  audit_type: AuditType
  status: AuditStatus
  tree_version_id: string | null
  datascope_form_id: string | null
  auditor_name: string | null
  auditor_email: string | null
  pdf_url: string | null
  raw_data: Record<string, unknown> | null
  audited_at: string | null
  effective_month: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  // Edición post-aprobación
  edited_at: string | null
  edited_by: string | null
  edit_note: string | null
  edited_pillar_names: string[] | null
  // Joined
  location?: Location
  reviewer?: User
}

export interface AuditPhoto {
  id: string
  audit_id: string
  question_id: string | null
  datascope_question_id: number | null
  photo_url: string
  label: string | null
  created_at: string
}

export interface WebhookLog {
  id: string
  form_id: string | null
  form_name: string | null
  location_code: string | null
  status: 'success' | 'error' | 'partial' | 'replayed'
  audit_id: string | null
  unmapped_questions: Record<string, unknown>[] | null
  error_message: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export interface AuditAnswer {
  id: string
  audit_id: string
  question_id: string | null
  raw_value: string | null
  ai_recommendation: string | null
  final_value: string | null
  selected_option_id: string | null
  decision: AnswerDecision | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  // Joined
  question?: Question
  selected_option?: QuestionOption
}

export interface Score {
  id: string
  audit_id: string
  location_id: string
  tree_version_id: string
  pillar_scores: PillarScore[]
  total_score: number
  calculated_at: string
}

export interface PillarScore {
  pillar_id: string
  pillar_name: string
  score: number
  weight: number
}

export interface Campaign {
  id: string
  campaign_code: string | null
  name: string
  description: string | null
  campaign_type: string | null
  status: CampaignStatus
  start_date: string | null
  end_date: string | null
  target_type: 'all' | 'segment' | 'individual'
  target_filter: Record<string, unknown> | null
  pillar_id: string | null
  is_recurring: boolean
  created_by: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
  // Joined
  creator?: User
  pillar?: Pillar
  campaign_locations?: CampaignLocation[]
  location_count?: number
}

export interface CampaignLocation {
  id: string
  campaign_id: string
  location_id: string
  result: 'pending' | 'success' | 'failed'
  notes: string | null
  executed_at: string | null
  // Joined
  location?: Location
}

export type OpportunityReviewStatus = 'pending' | 'approved' | 'rejected'
export type OpportunitySource = 'form' | 'manual' | 'rule' | 'ai_suggestion'

export interface Opportunity {
  id: string
  opportunity_code: string | null
  location_id: string
  description: string
  photos: string[] | null
  status: OpportunityStatus
  source: OpportunitySource
  created_by: string | null
  created_at: string
  updated_at: string
  campaign_id: string | null
  // Analysis columns
  category: string | null
  review_status: OpportunityReviewStatus
  triggering_audit_id: string | null
  occurrence_count: number
  last_seen_at: string | null
  ai_reasoning: string | null
  // Joined
  location?: Location
  creator?: User
  campaign?: Campaign
}

export interface LocationNote {
  id: string
  location_id: string
  note_type: NoteType
  content: string
  photos: string[] | null
  created_by: string | null
  created_at: string
  // Joined
  author?: User
}

export interface InventoryItem {
  id: string
  name: string
  material_type: string | null
  description: string | null
  photo_url: string | null
  current_balance: number
  min_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  inventory_id: string
  movement_type: MovementType
  quantity: number
  reason: string | null
  notes: string | null
  location_id: string | null
  created_by: string | null
  created_at: string
  // Joined
  inventory?: InventoryItem
  location?: Location
  creator?: User
}

export interface Staff {
  id: string
  first_name: string
  last_name: string
  email: string | null
  staff_type: StaffType
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Courier {
  id: string
  name: string
  tracking_url_template: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface ListItem {
  id: string
  category: ListCategory
  label: string
  value: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface LogisticsItem {
  id: string
  sku: string
  name: string
  current_stock: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LogisticsRequest {
  id: string
  request_code: string | null
  status: LogisticsRequestStatus
  requester_id: string | null
  requester_email: string | null
  logistics_item_id: string | null
  quantity: number
  location_id: string | null
  receiver_name: string
  receiver_address: string
  receiver_phone: string
  dispatch_comment: string | null
  warehouse_comment: string | null
  tracking_number: string | null
  tracking_link: string | null
  courier: string | null
  delivery_photo_url: string | null
  installation_photo_url: string | null
  cancellation_reason: string | null
  validated_at: string | null
  sent_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  installed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  // Joined
  requester?: User
  logistics_item?: LogisticsItem
  location?: Location
}

export interface LogisticsRequestStatusHistory {
  id: string
  request_id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  notes: string | null
  created_at: string
  // Joined
  user?: User
}
