export type Claim = { userId: string; requestedStart: string; requestedEnd: string; premiumUsage: number; totalUsage: number; previousPriority: number; eligible: boolean };
export type RankedClaim = Claim & { rank: number; reason: string };
/** Deterministic preview. The production assignment must run in a locked DB transaction. */
export function rankClaims(claims: Claim[]): RankedClaim[] {
  return claims.filter(c => c.eligible).sort((a,b) =>
    a.premiumUsage-b.premiumUsage || a.totalUsage-b.totalUsage || a.previousPriority-b.previousPriority || a.userId.localeCompare(b.userId)
  ).map((claim,i)=>({...claim,rank:i+1,reason:i===0?'Menor utilização premium, seguido de uso total e rodízio':'Classificado por histórico premium, uso total e rodízio'}));
}
export function splitCapacity(totalMinutes: number, owners: number): { baseMinutes: number; remainderMinutes: number } {
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes < 0 || !Number.isSafeInteger(owners) || owners < 1) throw new Error('Capacidade ou número de cotistas inválido');
  return { baseMinutes: Math.floor(totalMinutes/owners), remainderMinutes: totalMinutes%owners };
}
