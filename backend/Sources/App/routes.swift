import Vapor

func routes(_ app: Application) throws {
    // Health check
    app.get("health") { _ in ["status": "ok", "service": "draftly-api"] }
    app.get { _ in ["service": "Draftly API", "docs": "/docs"] }

    // Auth (no JWT required)
    let authCtrl = AuthController()
    app.post("auth", "register", use: authCtrl.register)
    app.post("auth", "login", use: authCtrl.login)

    // Protected routes — require valid JWT
    let protected = app.grouped(JWTMiddleware())

    // Proposals
    let propCtrl = ProposalController()
    protected.get("proposals", use: propCtrl.list)
    protected.post("proposals", use: propCtrl.create)
    protected.post("proposals", "generate", use: propCtrl.generate)
    protected.get("proposals", ":id", use: propCtrl.get)
    protected.patch("proposals", ":id", use: propCtrl.update)
    protected.delete("proposals", ":id", use: propCtrl.delete)
    protected.get("proposals", ":id", "export-docx", use: propCtrl.exportDocx)

    // Ingest
    let ingestCtrl = IngestController()
    protected.post("ingest", "pricing-csv", use: ingestCtrl.pricingCsv)
    protected.post("ingest", "proposal-file", use: ingestCtrl.proposalFile)
    protected.post("ingest", "proposal", ":id", use: ingestCtrl.reindexProposal)
    protected.post("ingest", "brand-voice", use: ingestCtrl.brandVoice)
    protected.get("ingest", "job", ":jobId", use: ingestCtrl.jobStatus)
    // KB article ingestion (admin-key gated, no JWT)
    app.post("ingest", "kb-article", use: ingestCtrl.kbArticle)

    // Context-Mapper
    let cmCtrl = ContextMapperController()
    protected.get("context-mapper", "status", use: cmCtrl.status)
    protected.get("context-mapper", "switching-cost", use: cmCtrl.switchingCost)

    // Support
    let suppCtrl = SupportController()
    protected.post("support", "tickets", use: suppCtrl.createTicket)
    protected.get("support", "tickets", use: suppCtrl.listTickets)
    protected.post("support", "tickets", ":id", "reply", use: suppCtrl.replyToTicket)
    protected.patch("support", "tickets", ":id", "resolve", use: suppCtrl.resolveTicket)
    protected.get("support", "admin", "tickets", use: suppCtrl.listAllTickets)

    // Churn
    let churnCtrl = ChurnController()
    protected.get("churn", "signals", use: churnCtrl.listSignals)
    protected.post("churn", "detect", use: churnCtrl.runDetection)
    protected.post("churn", "signals", ":id", "retention-email", use: churnCtrl.sendRetentionEmail)
    protected.get("churn", "admin", "signals", use: churnCtrl.listAllSignals)

    // CRM
    let crmCtrl = CRMController()
    // hubspotCallback is public — it's an OAuth redirect with customer_id in state param
    app.get("crm", "hubspot", "callback", use: crmCtrl.hubspotCallback)
    // hubspotConnect requires JWT to encode customer identity into state
    protected.get("crm", "hubspot", "connect", use: crmCtrl.hubspotConnect)
    protected.post("crm", "hubspot", "log-deal", use: crmCtrl.logDeal)
    protected.get("crm", "hubspot", "status", use: crmCtrl.hubspotStatus)
    protected.post("crm", "hubspot", "disconnect", use: crmCtrl.hubspotDisconnect)

    // Analytics
    let analyticsCtrl = AnalyticsController()
    protected.get("analytics", "unit-economics", use: analyticsCtrl.unitEconomics)
    protected.get("analytics", "win-rate", use: analyticsCtrl.winRate)
    protected.get("analytics", "phase-gate", use: analyticsCtrl.phaseGate)
    protected.get("analytics", "roi-summary", use: analyticsCtrl.roiSummary)
    protected.get("analytics", "aggregate-unit-economics", use: analyticsCtrl.aggregateUnitEconomics)
    protected.get("analytics", "industry-benchmark", use: analyticsCtrl.industryBenchmark)

    // Export (GDPR data portability)
    let exportCtrl = ExportController()
    protected.get("export", "full", use: exportCtrl.fullExport)
    protected.delete("export", "account", use: exportCtrl.deleteAccount)

    // GTM Agent (Phase 2 — exposed but gated by tier)
    let gtmCtrl = GTMController()
    protected.post("gtm", "meeting-signals", use: gtmCtrl.extractMeetingSignals)
    protected.post("gtm", "outreach-sequence", use: gtmCtrl.generateOutreachSequence)
    protected.get("gtm", "deal-signals", use: gtmCtrl.listDealSignals)
    protected.patch("gtm", "deal-signals", ":id", "stage", use: gtmCtrl.updateDealStage)

    // Pipedrive CRM integration
    let pipedriveCtrl = PipedriveController()
    protected.post("crm", "pipedrive", "save-key", use: pipedriveCtrl.saveApiKey)
    protected.post("crm", "pipedrive", "sync-deal", use: pipedriveCtrl.syncDeal)
    protected.get("crm", "pipedrive", "status", use: pipedriveCtrl.status)

    // Billing
    try app.register(collection: BillingController())
}
