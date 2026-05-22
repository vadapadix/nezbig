export class FullTextIndex {
    tokenPositions = new Map();
    constructor(tokens) {
        tokens.forEach((token, index) => {
            const positions = this.tokenPositions.get(token) ?? [];
            positions.push(index);
            this.tokenPositions.set(token, positions);
        });
    }
    rank(queryTokens) {
        const uniqueQuery = [...new Set(queryTokens)];
        if (uniqueQuery.length === 0)
            return 0;
        let hits = 0;
        let proximityBonus = 0;
        let lastPosition;
        for (const token of uniqueQuery) {
            const positions = this.tokenPositions.get(token);
            if (!positions?.length)
                continue;
            hits += 1;
            const firstPosition = positions[0];
            if (lastPosition !== undefined) {
                const distance = Math.abs(firstPosition - lastPosition);
                if (distance <= 18)
                    proximityBonus += 1;
            }
            lastPosition = firstPosition;
        }
        return Math.min(1, hits / uniqueQuery.length + (proximityBonus / Math.max(1, uniqueQuery.length - 1)) * 0.22);
    }
}
