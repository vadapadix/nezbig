export class FullTextIndex {
  private readonly tokenPositions = new Map<string, number[]>();

  constructor(tokens: string[]) {
    tokens.forEach((token, index) => {
      const positions = this.tokenPositions.get(token) ?? [];
      positions.push(index);
      this.tokenPositions.set(token, positions);
    });
  }

  rank(queryTokens: string[]): number {
    const uniqueQuery = [...new Set(queryTokens)];
    if (uniqueQuery.length === 0) return 0;

    let hits = 0;
    let proximityBonus = 0;
    let lastPosition: number | undefined;

    for (const token of uniqueQuery) {
      const positions = this.tokenPositions.get(token);
      if (!positions?.length) continue;
      hits += 1;

      // Find the position closest to lastPosition for better proximity scoring
      let bestPosition = positions[0];
      if (lastPosition !== undefined && positions.length > 1) {
        let minDistance = Math.abs(bestPosition - lastPosition);
        for (let i = 1; i < positions.length; i++) {
          const distance = Math.abs(positions[i] - lastPosition);
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = positions[i];
          }
          // Early exit if positions are sorted and we passed the optimal point
          if (positions[i] > lastPosition && distance > minDistance) break;
        }
      }

      if (lastPosition !== undefined) {
        const distance = Math.abs(bestPosition - lastPosition);
        if (distance <= 18) proximityBonus += 1;
      }
      lastPosition = bestPosition;
    }

    return Math.min(1, hits / uniqueQuery.length + (proximityBonus / Math.max(1, uniqueQuery.length - 1)) * 0.22);
  }
}
