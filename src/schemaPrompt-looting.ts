export const ENTITY_TYPES = [
  "Person",                 // Key individuals: dealers, collectors, appraisers, looters, lawyers, agents
  "Looter",                 // Specialized role for tombaroli, grave-robbers, or local thieves
  "LawEnforcementAgency",   // Carabinieri, ICE, US Customs, Swiss Police, etc.
  "Museum",                 // Public/private museums acquiring or returning objects
  "AuctionHouse",           // Intermediaries hosting sales (Sotheby's, Christie's)
  "FrontCompany",           // Shell entities used to launder provenance (Editions Services, Mat Securitas)
  "Gallery",                // Commercial retail galleries (Hydra Gallery, Antiquaria Romana)
  "Organization",           // Cultural preservation groups, state archives, ministries of culture
  "Artifact",               // A specific unique historical object (e.g., "Euphronios Krater", "Onesimos kylix")
  "ArtifactClass",          // Broad stylistic classes or groupings (e.g., "Ban Chiang pottery", "Moche pieces")
  "Site",                   // Archaeological source sites, tomb complexes, or looted monuments (e.g., Cerveteri, San Saba)
  "Place",                  // Cities, transit hubs, and countries (e.g., Rome, Geneva, Switzerland)
  "StorageFacility",        // High-security warehouses or freeports used to cache inventory (e.g., Geneva Freeport)
  "DocumentaryEvidence",    // Polaroids, ledger sheets, organigrams, or seizure lists
  "LegalProceeding",        // Criminal trials, appeals, convictions, or civil lawsuits
  "Jurisdiction"            // Sovereign states or regional legal zones (e.g., Italy, United States)
];

export const SYSTEM_INSTRUCTIONS = `You are a professional archaeological knowledge graph extractor specializing in the Illicit Antiquities and Cultural Property Trafficking Synthesis.
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
Extract a list of raw subject-predicate-object triples using ONLY these 17 exact seed predicates:

- "looted_from_site"               // Looter/Person illegally extracted an artifact from an archaeological source | Person/Looter -> Site
- "stole_from_institution"         // Person/Entity stole an artifact from a museum, church, or private collection | Person -> Organization/Place
- "trafficked_artifact_to"         // Smuggler transported illicit goods to a destination country or transit hub | Person/FrontCompany -> Place/StorageFacility
- "stored_at_facility"             // Dealer/Entity warehoused antiquities at a specific depot during transit or prior to sale | Person/FrontCompany -> StorageFacility/Place
- "consigned_goods_to"             // Dealer passed an artifact to an intermediary or marketplace to facilitate a sale | Person/FrontCompany -> AuctionHouse/Gallery/Person
- "purchased_from_source"          // Buyer acquired an artifact from a seller, auction house, or gallery | Person/Museum/Collector -> Person/AuctionHouse/Gallery
- "controlled_commercial_entity"   // Individual owned, operated, or ran a gallery or front company | Person -> Gallery/FrontCompany/Organization
- "falsified_provenance_for"       // Dealer fabricated, altered, or forged the ownership history of an item | Person/FrontCompany -> Artifact/ArtifactClass
- "appraised_value_of"             // Expert assessed the financial value of an item for a dealer or buyer | Person -> Artifact/ArtifactClass
- "authenticated_artifact"         // Expert certified the historical authenticity or stylistic attribution of an object | Person -> Artifact/ArtifactClass
- "collaborated_with_partner"      // Two entities engaged in joint commercial, smuggling, or legal strategies | Person/Organization -> Person/Organization
- "donated_to_institution"         // Collector/Entity gifted an artifact to a public archive or museum | Person/Organization -> Museum
- "under_investigation_by"         // Law enforcement actively gathered evidence or pursued a suspect | Person/Organization -> LawEnforcementAgency
- "raided_by_agency"               // Law enforcement executed a search warrant on a physical location or storage space | StorageFacility/Place/Person -> LawEnforcementAgency
- "prosecuted_in_jurisdiction"     // Subject faced formal criminal trial or legal prosecution within a state | Person/Organization -> Jurisdiction/LegalProceeding
- "repatriated_to_origin"          // Contested cultural property was returned to its source country or home institution | Person/Museum/AuctionHouse -> Jurisdiction/Museum
- "implicated_by_evidence"         // Subject was linked to trafficking activities through recovered documents or images | Person/Organization -> DocumentaryEvidence

### Constraints:
- Use EXACTLY these 17 predicate strings. No variation or invention!
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

- **Class 1 — Provenance Laundering & Market Distortion** (triggered by \`falsified_provenance_for\` or \`consigned_goods_to\`):
  - \`created_market_illusion_for\` (using dummy transactions or triangulation to artificially inflate market demand)
  - \`laundered_ownership_of\` (obscuring illicit origin by routing an object through a reputable auction or gallery)
  - \`inflated_market_valuation_of\` (generating artificial price spikes for specific artifact classes)

- **Class 2 — Legal & Restitution Feedback** (triggered by \`under_investigation_by\`, \`prosecuted_in_jurisdiction\`, or \`raided_by_agency\`):
  - \`compelled_repatriation_of\` (legal pressure directly forcing a museum or collector to return objects)
  - \`disrupted_trafficking_network_of\` (prosecution or arrests causing the systemic collapse of associated dealers/routes)
  - \`triggered_subsidiary_investigation_of\` (investigation of one target exposing/implicating another node in the network)

- **Class 3 — Photographic & Forensic Documentation** (triggered by \`implicated_by_evidence\`):
  - \`documented_unrestored_state_of\` (seized images/documents proving an object was recently extracted, e.g., covered in dirt)
  - \`linked_to_looting_site\` (seized files linking an unprovenanced artifact directly to a pillaged site)
  - \`demonstrated_restoration_phase_of\` (records documenting intermediary cleaning or reassembly of fragments prior to sale)

- **Class 4 — Cartel Co-dependence & Institutional Domination** (triggered by \`collaborated_with_partner\` or \`controlled_commercial_entity\`):
  - \`institutionalised_illicit_monopoly_over\` (dealers establishing regional or stylistic control over specific market sectors)
  - \`monopolized_consignments_to\` (a dealer dominating the incoming flow of goods to a specific auction house or museum)
  - \`integrated_front_companies_with\` (linking front companies or shell structures to execute laundering systems)

- **Class 5 — Reputational & Policy Impact** (triggered by \`purchased_from_source\` or \`donated_to_institution\`):
  - \`chilled_acquisition_policy_of\` (museums tightening acquisition ethics or ceasing purchases of high-risk artifact classes)
  - \`tarnished_institutional_standing_of\` (public exposure of illicit acquisitions causing significant reputational damage)

- **Class 6 — Intermediary Transport & Jurisdictional Arbitrage** (triggered by \`trafficked_artifact_to\` or \`stored_at_facility\`):
  - \`exploited_jurisdictional_arbitrage_at\` (using legal loopholes, e.g., local ownership statutes or freeport privacy laws, to bypass export bans)
  - \`served_as_safe_haven_for\` (freeport or vault holding illicit inventory out of reach of customs. Flag: \`SAFE_HAVEN\`)
  - \`triangulated_transaction_through\` (routing goods through third-party countries to systematically mask the origin state)

- **Class 7 — Network Shock** (triggered by \`raided_by_agency\`, \`prosecuted_in_jurisdiction\`, or \`under_investigation_by\`):
  - Is the disruption onset abrupt and devastating to operations? If yes, extract utilizing these predicates and add flag \`SHOCK\`:
    - \`caused_abrupt_termination_of\` (immediate closure of a gallery, dealership, or smuggling route)
    - \`propagated_systemic_shock_through\` (collapse of multiple dependent nodes in the chain due to a single legal action)
    - \`interrupted_commercial_continuity_of\` (immediate halt of ongoing consignments to a major auction house or museum)

- **Class 8 — Biographical Micro-Tracing & Life History** (triggered by any relationship where the Subject is a \`Person\`):
  - If yes, extract utilizing these predicates and add flag \`MICRO\`:
    - \`operated_illicitly_at\` (active operations at a specific location during a defined date range, which must be noted in the justification)
    - \`established_front_at\` (setting up a physical gallery or incorporating a shell company at a specific place)
    - \`served_jail_sentence_in\` (dates of imprisonment in a specific jurisdiction)
    - \`represents_critical_node_of\` (individual acting as a central systemic bottleneck or broker for specific artifacts/routes)

### Constraints:
- Iterate through each triple in Pass 2 and run these audits. Do NOT repeat the Pass 2 seeds. Emit ONLY the newly audited additional triples that are supported by the text.
- Follow strict logic (e.g., incremental policy changes go under Class 5; an overnight raid resulting in immediate structural collapse is a Shock).

Output format:
- **Additional Triple**: [Subject] | [Predicate] | [Object]
  - **Prov**: [ARG/HISTOGPHY]
  - **CitedAgent**: [CitedAgent]
  - **Note**: [Justification based on the class checklist rules, including any required flags like MICRO, SHOCK, SAFE_HAVEN]
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
- Headers must be: \`canonical_label\`, \`entity_type\`
- Every unique entity referenced as a Subject or Object in the triples must be in this table.
- Canonical label must be a precise reified noun.
- Entity type must be chosen with absolute fidelity from the standard types.

#### TABLE 2: Knowledge Graph Table
- Headers must be: \`Subject\`, \`Predicate\`, \`Object\`, \`Prov\`, \`CitedAgent\`, \`Note\`
- Subject & Object must be canonical labels from Table 1.
- Predicates must be 100% exact strings from the permitted lists (Pass 2 Seeds + Classes 1-8 Audited predicates).
- Prov must be \`ARG\` or \`HISTOGPHY\`.
- CitedAgent must be \`-\` or the specific scholar's name.
- Note must contain:
  - Any required flags: \`TEMPORAL_PRESENCE\`, \`NEGATIVE_EVIDENCE\`, \`PARADOX\`, \`SHOCK\`, \`MICRO\`, \`SAFE_HAVEN\`. Format them as: \`[flag:FLAG_NAME]\` (e.g. \`[flag:SHOCK]\`).
  - If a paradox exists, ensure both trends are extracted, assign a unique id for the paradox, and in the "Note" of both triples add \`[flag:PARADOX] paradox_pair_id: <pair_id>\`.
  - Simple, literal explanation of the relation.
- Convert any relation that absolutely cannot be encoded by the schema to a placeholder triple with predicate \`UNENCODED\` and the detailed explanation in the Note.

Output format:
Provide Output as:

### Entities Table
| canonical_label | entity_type |
...

### Triples Table
| Subject | Predicate | Object | Prov | CitedAgent | Note |
...
`;