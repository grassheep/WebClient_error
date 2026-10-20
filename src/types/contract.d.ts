/**
 * 《轻眸识刻》WebClient 跨仓权威契约 TypeScript 类型定义
 * 对应权威单事实源 (SSOT): ProjectPRD/contracts/schemas/*.schema.json & openapi.json
 */

export type DetectionCategory =
  | 'date_area'
  | 'mfg_line'
  | 'exp_line'
  | 'shelf_life_line'
  | 'lot_line';

export type LineRole =
  | 'mfg_line'
  | 'exp_line'
  | 'shelf_life_line'
  | 'lot_line'
  | 'unknown';

export type SemanticField =
  | 'mfg_date'
  | 'exp_date'
  | 'shelf_life'
  | 'storage_condition';

export type CorrectedField = SemanticField | 'start_mode';

export type ShelfLifeUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type FactSourceType = 'MODEL' | 'MANUAL' | 'BARCODE_CATALOG';

export type ConflictCode =
  | 'MULTI_VALUE_CONFLICT'
  | 'DERIVED_VS_DIRECT_MISMATCH'
  | 'EXP_PRECEDES_MFG'
  | 'FUTURE_MFG_DATE'
  | 'BARCODE_VS_OCR_MISMATCH';

export type MarkedStatus =
  | 'WITHIN_MARKED_PERIOD'
  | 'NEAR_EXPIRY'
  | 'PAST_MARKED_PERIOD'
  | 'UNDETERMINED';

export type ReviewStatus =
  | 'EVIDENCE_COMPLETE'
  | 'INFORMATION_MISSING'
  | 'EVIDENCE_CONFLICT'
  | 'LOW_CONFIDENCE';

export interface ImageSize {
  width: number;
  height: number;
}

export interface QualityMetrics {
  blurriness_score?: number;
  overexposure_ratio?: number;
}

export interface BarcodeObservation {
  type: string;
  value: string;
  confidence: number | null;
}

export interface AdaptiveTrace {
  retried?: boolean;
  operator?: string;
  raw_before_retry?: string | null;
  gain_score?: number | null;
}

export interface DetectionBox {
  box_id: string;
  category: DetectionCategory;
  bbox: [number, number, number, number];
  bbox_format: 'xyxy';
  coordinate_space: 'original_image';
  confidence: number;
  transcription: string | null;
  text_confidence: number | null;
  character_confidences?: number[];
  polygon?: Array<[number, number]>;
  line_role?: LineRole;
  crop_url?: string | null;
  adaptive_trace?: AdaptiveTrace;
}

export interface GlobalTextLine {
  transcription: string;
  confidence: number | null;
}

export interface Observation {
  schema_version: 'observation';
  observation_id: string;
  image_id: string;
  session_id?: string | null;
  model_version: string;
  generated_at: string;
  image_size: ImageSize;
  quality_passed: boolean | null;
  detections: DetectionBox[];
  quality_metrics?: QualityMetrics;
  global_texts?: GlobalTextLine[];
  barcode?: BarcodeObservation;
}

export interface ShelfLife {
  value: number;
  unit: ShelfLifeUnit;
}

export interface ModelFactItem {
  fact_id: string;
  field: SemanticField;
  value: string | ShelfLife;
  raw_text: string | null;
  source_type: 'MODEL';
  source_image_id: string;
  source_observation_id: string;
  source_box_id: string | null;
  source_correction_id: null;
  source_barcode_gtin?: null;
  barcode_catalog_id?: null;
  confidence: number | null;
  eligible_for_decision: boolean;
}

export interface ManualFactItem {
  fact_id: string;
  field: SemanticField;
  value: string | ShelfLife;
  raw_text: string | null;
  source_type: 'MANUAL';
  source_image_id: string;
  source_observation_id: string | null;
  source_box_id: string | null;
  source_correction_id: string;
  source_barcode_gtin?: null;
  barcode_catalog_id?: null;
  confidence: null;
  eligible_for_decision: boolean;
}

export interface BarcodeCatalogFactItem {
  fact_id: string;
  field: SemanticField;
  value: string | ShelfLife;
  raw_text: string | null;
  source_type: 'BARCODE_CATALOG';
  source_image_id: string;
  source_observation_id: null;
  source_box_id: null;
  source_correction_id: null;
  source_barcode_gtin: string;
  barcode_catalog_id: string;
  confidence: number | null;
  eligible_for_decision: boolean;
}

export type FactItem = ModelFactItem | ManualFactItem | BarcodeCatalogFactItem;

export interface ConflictItem {
  field: SemanticField;
  fact_ids: string[];
  reason: string;
  conflict_code?: ConflictCode;
}

export interface Evidence {
  schema_version: 'evidence';
  evidence_id: string;
  session_id: string;
  generated_at: string;
  parser_version: string;
  facts: FactItem[];
  conflicts: ConflictItem[];
  missing_fields: string[];
  evidence_hash: string;
}

export interface EvidenceSnapshot {
  mfg_date: string | null;
  shelf_life: ShelfLife | null;
  exp_date: string | null;
  exp_date_is_derived: boolean | null;
  remaining_days: number | null;
}

export interface Decision {
  schema_version: 'decision';
  decision_id: string;
  session_id: string;
  marked_status: MarkedStatus;
  review_status: ReviewStatus;
  observed_at: string;
  generated_at: string;
  timezone: string;
  calculation_rule_version: 'date-rules';
  calculation_profile_id: string;
  evidence_schema_version: 'evidence';
  evidence_id: string;
  evidence_hash: string;
  evidence_snapshot: EvidenceSnapshot;
  used_fact_ids: string[];
  missing_fields: string[];
  warnings: string[];
  guidance: string | null;
}

export interface Correction {
  schema_version: 'correction';
  image_id: string;
  corrected_field: CorrectedField;
  corrected_value: string | ShelfLife;
  correction_reason: string;
  decision_id?: string | null;
  evidence_id?: string | null;
}
