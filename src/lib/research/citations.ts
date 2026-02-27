import type { Citation } from "@/lib/types";

export interface ResearchClaim {
  claimRef: string;
  text: string;
  citations: Citation[];
}

export function validateClaimCitations(claims: ResearchClaim[]): { valid: boolean; error?: string } {
  for (const claim of claims) {
    if (!claim.citations || claim.citations.length === 0) {
      return {
        valid: false,
        error: `Missing citations for claim ${claim.claimRef}`,
      };
    }

    for (const citation of claim.citations) {
      if (!citation.url || !citation.title || !citation.quote || !citation.claimRef) {
        return {
          valid: false,
          error: `Incomplete citation in claim ${claim.claimRef}`,
        };
      }
    }
  }

  return { valid: true };
}
