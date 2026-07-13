export function emptySearchDiagnostics() {
    return {
        providers: [],
        pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 }
    };
}
export function mergeSearchDiagnostics(...items) {
    const providers = new Map();
    const pages = { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 };
    for (const item of items) {
        for (const diagnostic of item.providers) {
            const current = providers.get(diagnostic.provider) ?? {
                provider: diagnostic.provider,
                attempted: 0,
                succeeded: 0,
                failed: 0,
                timedOut: 0,
                results: 0,
                skippedReason: diagnostic.skippedReason
            };
            current.attempted += diagnostic.attempted;
            current.succeeded += diagnostic.succeeded;
            current.failed += diagnostic.failed;
            current.timedOut += diagnostic.timedOut;
            current.results += diagnostic.results;
            if (diagnostic.skippedReason)
                current.skippedReason = diagnostic.skippedReason;
            providers.set(diagnostic.provider, current);
        }
        pages.attempted += item.pages.attempted;
        pages.verified += item.pages.verified;
        pages.unavailable += item.pages.unavailable;
        pages.cacheHits += item.pages.cacheHits;
        pages.negativeCacheHits += item.pages.negativeCacheHits;
    }
    return { providers: [...providers.values()], pages };
}
export function searchDiagnosticsNotes(diagnostics) {
    const providerSummary = diagnostics.providers.map((provider) => {
        if (provider.attempted === 0)
            return `${provider.provider}: пропущено`;
        const issue = provider.failed ? `, ${provider.failed} пом.` : "";
        return `${provider.provider}: ${provider.succeeded}/${provider.attempted}, ${provider.results} рез.${issue}`;
    }).join(" · ");
    const notes = providerSummary ? [`Вебіндекси: ${providerSummary}.`] : [];
    if (diagnostics.pages.attempted || diagnostics.pages.cacheHits || diagnostics.pages.negativeCacheHits) {
        notes.push(`Перевірка сторінок: підтверджено ${diagnostics.pages.verified}, недоступно ${diagnostics.pages.unavailable}, кеш-влучень ${diagnostics.pages.cacheHits}, повторно не завантажувались ${diagnostics.pages.negativeCacheHits}.`);
    }
    return notes;
}
