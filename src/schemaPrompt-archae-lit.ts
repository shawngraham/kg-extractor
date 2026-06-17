export const ENTITY_TYPES = [
  "Scholar", "Survey Programme", "Research Project", "Site", "ArtifactClass", "Survey Area", "Dataset",
  "Concept", "InterpretiveFramework", "Process", "Condition", "SocialGroup", "Organisation", "EconomicActivity",
  "LandUseType", "SettlementForm", "Resource", "Place", "Waterbody", "GeologicalFeature", "SurveyZone", "Infrastructure",
  "HumanActivity", "AgriculturalPractice", "ClimaticCondition", "EcologicalCondition", "PoliticalActor", "MilitaryForce",
  "Faction", "Dynasty", "ConflictEvent", "MilitaryEpisode", "ForcedResettlement", "Population", "Community", "Settlement",
  "RuralCommunity", "PopulationCategory", "UrbanCentre", "DeclineProcess", "AbandonmentType", "PopulationLossCategory",
  "Person", "Family", "ImperialInstitution", "Estate", "Villa", "PropertyComplex", "CivicBody", "CivicMonument",
  "NamedBuilding", "Road", "River", "Port", "Canal", "CommodityType", "Route", "WorkshopComplex", "Commodity",
  "RawMaterial", "Institution", "SocialPractice", "LegalMechanism", "Cult", "Period", "ChronologicalPhase",
  "AgriculturalZone", "FarmingZone", "ProductionSystem", "LandscapeDegradation", "EcologicalThresholdEvent",
  "AlteredLandscapeState", "DrainageSystem", "TerraceNetwork", "LabourSupply", "ContractingZone", "AbandonmentEpisode",
  "DemographicProcess", "ExpandingZone", "AdjacentSurveyArea", "Pagus", "Vicus", "FoundationPhaseSite", "PriorPractice",
  "Technique", "BuildingProgramme", "DepartureZone", "DisplacementProcess", "CivicZone", "Sanctuary", "TempleComplex",
  "FestivalSite", "SacredLandscapeFeature", "MarketSite", "SocialFunction", "RitualPractice", "RegionalCommunity",
  "RegionalPopulation", "DispersedCommunity", "NamedSettlementNetwork", "StructuralEconomicCondition", "TenureArrangement",
  "LandUseChange", "PatronClientRelation", "MarketAccessMechanism", "ClayDistrict", "QuarrySystem", "IndustrialResourceArea",
  "RawMaterialZone"
];

export const SYSTEM_INSTRUCTIONS = `You are a professional archaeological knowledge graph extractor specializing in the Middle Tiber Valley Archaeological Synthesis.
You process text and generate structural, formal data following strict guidelines.
Never invent any facts. Do not write descriptions, introductory remarks, or summaries unless explicitly requested. Provide only clean, well-formed markdown results as requested.`;

export const P1_PROMPT = `
You are running **Pass 1: Reify & Tag** of the Knowledge Graph extraction pipeline.

### Input Text:
"""
{{inputText}}
"""

### Core Instructions for Pass 1:
1. Identify all entities in the text that belong to these permitted types:
${ENTITY_TYPES.map(t => `- ${t}`).join("\n")}

2. Output a markdown table containing all identified entities.
3. Every entity must have:
   - A canonical label (Noun phrase, never clauses, concrete noun-form). Example: use "Uniform Nomenclature Policy" instead of "needed a single authoritative name".
   - An entity type chosen strictly from the permitted types list above.
   - A provenance tag:
     - "ARG": Source author's own claim (CiteAgent is "-").
     - "HISTOGPHY": Attributed to prior scholarship (CiteAgent must be the specific scholars' name mentioned).
   - The specific text/excerpt justifying this entity.

4. Convert passive voice in claims to active voice (e.g. "Edict revoked by King" -> Subject: King, Object: Edict).
5. Output format must be EXACTLY a markdown table with headers:
| Canonical Label | Entity Type | Provenance | Cited Agent | Text Background / Excerpt |
`;

export const P2_PROMPT = `
You are running **Pass 2: Seed Triples** of the Knowledge Graph extraction pipeline.

### Input Text:
"""
{{inputText}}
"""

### Pass 1 Entities Table:
"""
{{p1Output}}
"""

### Core Instructions for Pass 2:
Extract a list of raw subject-predicate-object triples using ONLY these 16 exact seed predicates:

- \`analyzed_archaeological_evidence\` (Scholar/project examined physical/site evidence | Scholar/Project -> Site/ArtifactClass/Dataset/Area)
- \`proposed_conceptual_model\` (Scholar originated/advanced an explanatory framework | Scholar/Group -> Concept/Framework)
- \`critiqued_conceptual_model\` (Scholar challenged/rejected a framework | Scholar/Group -> Concept/Framework)
- \`drove_socio_economic_demand\` (Process/group/org generated/intensified demand for X | Process/Group -> EconomicActivity/LandUseType/Resource)
- \`altered_physical_landscape_of\` (Subject produced lasting physical change to terrain | Process/Infrastructure -> Place/Waterbody/Feature)
- \`caused_environmental_change\` (Subject initiated/accelerated an environmental process | Activity/Practice -> Process/EcologicalCondition)
- \`engaged_in_political_conflict\` (Actor participated in armed/factional/institutional conflict | Actor/Force -> Place/Entity/Episode)
- \`experienced_settlement_expansion\` (Documented increase in sites/density/urban dev | Place/Zone -> SettlementForm/Category)
- \`experienced_settlement_contraction\` (Documented reduction/abandonment/urban decline | Place/Zone -> DeclineProcess/Type)
- \`owned_elite_property\` (Agrarian property only | Person/family/institution held named agrarian property | Person/Family -> Estate/Villa)
- \`sponsored_infrastructure_development\` (Funded/commissioned/built named infrastructure | Person/CivicBody -> Infrastructure/Monument)
- \`functioned_as_transport_network_for\` (Road/river/port was primary movement corridor | Road/River -> Place/Commodity/Route)
- \`functioned_as_production_center_for\` (Place/workshop/estate produced named output | Place/Workshop -> Commodity/Artifact)
- \`facilitated_civic_integration_of\` (Institution/practice/cult gave group civic/legal access | Institution -> SocialGroup/Community)
- \`used_as_diagnostic_marker\` (Scholars use artifact/technique for dating | Artifact/Technique -> Period/Phase)
- \`produced_economic_resource\` (Place/feature was documented source of resource | Place/Zone -> Commodity/RawMaterial)

### Constraints:
- Use EXACTLY these 16 predicate strings. No variation or invention!
- Passive claims must be converted to active voice.
- Subject and Object must be canonical entity labels from Pass 1.
- Provide a summary explanation or Note for each triple.
- For each triple, list the Provenance (ARG or HISTOGPHY), and CitedAgent (from Pass 1).

Output format:
A markdown list of triples in the format:
- **Triple**: [Subject] | [Predicate] | [Object]
  - **Prov**: [ARG/HISTOGPHY]
  - **CitedAgent**: [CitedAgent]
  - **Note**: [Brief plain language justification from the text]
`;

export const P3_PROMPT = `
You are running **Pass 3: Class Audits** of the Knowledge Graph extraction pipeline.

### Input Text:
"""
{{inputText}}
"""

### Pass 1 Entities Table:
"""
{{p1Output}}
"""

### Pass 2 Triples:
"""
{{p2Output}}
"""

### Core Instructions for Pass 3:
Review each triple identified in Pass 2 and evaluate it systemically against the following 8 audit classes. If the text justifies them, emit **additional** triples.

- **Class 1 — Environmental Feedback** (triggered by \`altered_physical_landscape_of\` or \`caused_environmental_change\`):
  - \`constrained_agricultural_activity_of\` (reversible limitation)
  - \`degraded_productive_capacity_of\` (cumulative, irreversible ratchet)
  - \`forced_settlement_reorganisation_of\` (necessity, non-optional shift)
  - \`increased_disease_burden_of\` (waterlogging/hydrology pathogen load increases)

- **Class 2 — Conflict-Environment** (triggered by \`engaged_in_political_conflict\`):
  - \`disrupted_agricultural_maintenance_of\` (interrupted labor, neglect deterioration)
  - \`accelerated_landscape_abandonment_of\` (war-compressed gradual decline)
  - \`displaced_population_from\` (non-voluntary movement)

- **Class 3 — Settlement Transition** (triggered by \`experienced_settlement_contraction\` or \`displaced_population_from\`):
  - \`generated_settlement_pressure_on\` (push to expansion zone)
  - \`received_displaced_population_from\` (arrival at arrival site)
  - \`adapted_practice_from\` (new site shows prior site practice)

- **Class 4 — Competitive Institution** (triggered by \`sponsored_infrastructure_development\`):
  - \`institutionalised_competitive_claim_over\` (asserting non-material dominance)
  - \`constrained_subsequent_competition_at\` (reduced options for later actors)
  - \`replicated_institutional_form_from\` (referencing prior regional acts)

- **Class 5 — Social Transformation** (triggered by qualitative role changes / mobility):
  - \`converted_social_role_of\` (qualitative change in identity/legal status of a group)
  - \`enabled_social_mobility_of\` (structural condition enabling movement between positions)

- **Class 6 — Temporal & Industrial**:
  - \`functioned_as_periodic_central_place_for\` (periodic/seasonal/festival function without permanent density. Flag: \`TEMPORAL_PRESENCE\`)
  - \`served_as_ritual_catchment_for\` (sanctuary integrating dispersed population)
  - \`controlled_industrial_resource_of\` (elite/state control of quarry, clay, or resources. NOT agrarian property)
  - \`invested_in_manufacturing_of\` (elite ownership of workshop, brickworks, kiln etc)
  - \`supplied_raw_material_to\` (quarry/clay to workshop/infrastructure)

- **Class 7 — Shock** (triggered by abrupt, overnight, non-linear system resets):
  - Is onset abrupt? If yes, extract utilizing these predicates and add flag \`SHOCK\`:
    - \`caused_abrupt_termination_of\`
    - \`propagated_systemic_shock_through\`
    - \`interrupted_institutional_continuity_of\`
    - \`preceded_recovery_trajectory_of\`

- **Class 8 — Micro-Migration & Life History** (triggered by named individuals and biographical life events):
  - If yes, extract utilizing these predicates and add flag \`MICRO\`:
    - \`migrated_from_to\` (reify as two claims: [Subject] | \`migrated_from\` | [Origin Place] and [Subject] | \`migrated_to\` | [Destination Place])
    - \`attested_social_position_at\` (requires date range in note/column)
    - \`commemorated_by_epigraphy_at\` (individual social strategy)
    - \`maintained_patron_client_tie_with\` (with person, family, body)
    - \`represents_atypical_life_trajectory_of\` (exceptions to regional trends)

### Constraints:
- Iterate through each triple in Pass 2 and run the audits. Do NOT repeat the Pass 2 seeds. Emit ONLY the newly audited additional triples that are supported by the text.
- Follow the discrimination logic (e.g. Agrarian is \`owned_elite_property\`, industrial is \`controlled_industrial_resource_of\`; incremental decline is Process, overnight reset is Shock).

Output format:
- **Additional Triple**: [Subject] | [Predicate] | [Object]
  - **Prov**: [ARG/HISTOGPHY]
  - **CitedAgent**: [CitedAgent]
  - **Note**: [Justification based on the class checklist rules, including any required flags like MICRO, SHOCK, TEMPORAL_PRESENCE]
`;

export const P4_PROMPT = `
You are running **Pass 4: Structure & Flag** to produce the final canonical knowledge graph and entity definitions from all previous extraction stages.

### Pass 1, 2, and 3 inputs:
PASS 1 ENTITIES:
"""
{{p1Output}}
"""

ALL PROPOSED TRIPLES (PASS 2 & PASS 3):
"""
{{p2Output}}

{{p3Output}}
"""

### Core Instructions for Pass 4:
1. Resolve all entities to their canonical labels. Make sure there are no duplicate or slightly misaligned names for the same entity.
2. Formulate TWO standalone markdown tables. Avoid adding any surrounding conversational text or prefaces.

#### TABLE 1: Entity Table
- Headers must be: \`coanonical_label\`, \`entity_type\`
- Every unique entity referenced as a Subject or Object in the triples must be in this table.
- Canonical label must be a precise reified noun.
- Entity type must be chosen with absolute fidelity from the standard types.

#### TABLE 2: Knowledge Graph Table
- Headers must be: \`Subject\`, \`Predicate\`, \`Object\`, \`Prov\`, \`CitedAgent\`, \`Note\`
- Subject & Object must be canonical labels from Table 1.
- Predicates must be 100% exact strings from the permitted lists (v1.0 + Classes 1-8 predicates).
- Prov must be \`ARG\` or \`HISTOGPHY\`.
- CitedAgent must be \`-\` or the specific scholar's name.
- Note must contain:
  - Any required flags: \`TEMPORAL_PRESENCE\`, \`NEGATIVE_EVIDENCE\`, \`PARADOX\`, \`SHOCK\`, \`MICRO\`. Format them as: \`[flag:FLAG_NAME]\` (e.g. \`[flag:TEMPORAL_PRESENCE]\`).
  - If a paradox exists, ensure both trends are extracted, assign a unique id for the paradox, and in the "Note" of both triples add \`[flag:PARADOX] paradox_pair_id: <pair_id>\`.
  - Simple, literal explanation of the relation.
- Convert any relation that absolutely cannot be encoded by the schema to a placeholder triple with predicate \`UNENCODED\` and the detailed explanation in the Note.

Output format:
Provide Output as:

### Entities Table
| coanonical_label | entity_type |
...

### Triples Table
| Subject | Predicate | Object | Prov | CitedAgent | Note |
...
`;
