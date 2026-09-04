"""
ResQNet Domain Schemas - Victim Models & Prioritization
"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from app.schemas.common import Vector3D, UncertaintyState, SeverityLevel


class VictimPriorityClass(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


class VictimStatus(str, Enum):
    DETECTED = "DETECTED"
    TRIAGED = "TRIAGED"
    EN_ROUTE = "EN_ROUTE"
    ASSISTED = "ASSISTED"
    EVACUATED = "EVACUATED"


class VictimPriorityBreakdown(BaseModel):
    medical_severity_weight: float = 0.35
    urgency_weight: float = 0.25
    exposure_weight: float = 0.20
    accessibility_weight: float = 0.10
    confidence_weight: float = 0.10

    raw_medical_severity: float = Field(ge=0.0, le=1.0)
    raw_urgency: float = Field(ge=0.0, le=1.0)
    raw_exposure: float = Field(ge=0.0, le=1.0)
    raw_accessibility: float = Field(ge=0.0, le=1.0)
    raw_confidence: float = Field(ge=0.0, le=1.0)

    calculated_score: float = Field(ge=0.0, le=1.0)
    reasons: List[str] = Field(default_factory=list)


class Victim(BaseModel):
    id: str = Field(..., description="Unique victim identifier e.g. VIC-101")
    name: Optional[str] = "Unknown Individual"
    location: Vector3D
    people_count: int = Field(default=1, ge=1)
    medical_severity: float = Field(default=0.5, ge=0.0, le=1.0, description="0=uninjured, 1=lethal emergency")
    estimated_survival_urgency: float = Field(default=0.5, ge=0.0, le=1.0)
    hazard_exposure: float = Field(default=0.0, ge=0.0, le=1.0, description="Proximity to fire/collapse")
    accessibility_factor: float = Field(default=0.8, ge=0.0, le=1.0, description="1=fully open, 0=buried under rubble")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    uncertainty_state: UncertaintyState = UncertaintyState.CONFIRMED

    priority_score: float = Field(default=0.0, ge=0.0, le=1.0)
    priority_class: VictimPriorityClass = VictimPriorityClass.UNKNOWN
    status: VictimStatus = VictimStatus.DETECTED
    assigned_drone_id: Optional[str] = None
    assigned_mission_id: Optional[str] = None

    detected_at: float = Field(default=0.0, description="Simulation timestamp in seconds")
    last_updated_at: float = Field(default=0.0)
    breakdown: Optional[VictimPriorityBreakdown] = None
    notes: List[str] = Field(default_factory=list)
