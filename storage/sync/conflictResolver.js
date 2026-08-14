/* Productive OS - Deterministic Conflict Resolver (Last-Write-Wins + Delete Rules) */

const ConflictResolver = {
  resolve(localRecord, remoteRecord) {
    if (!remoteRecord) return localRecord;
    if (!localRecord) return remoteRecord;

    // Check soft deletions
    const localDeletedTime = localRecord.deletedAt ? new Date(localRecord.deletedAt).getTime() : 0;
    const remoteDeletedTime = remoteRecord.deleted_at || remoteRecord.deletedAt ? new Date(remoteRecord.deleted_at || remoteRecord.deletedAt).getTime() : 0;
    const localUpdatedTime = new Date(localRecord.updatedAt || localRecord.created_at || 0).getTime();
    const remoteUpdatedTime = new Date(remoteRecord.updated_at || remoteRecord.updatedAt || remoteRecord.created_at || 0).getTime();

    const localMaxTime = Math.max(localDeletedTime, localUpdatedTime);
    const remoteMaxTime = Math.max(remoteDeletedTime, remoteUpdatedTime);

    // 1. Timestamp Comparison (Last-Write-Wins)
    if (localMaxTime > remoteMaxTime) return localRecord;
    if (remoteMaxTime > localMaxTime) return remoteRecord;

    // 2. Deterministic Tie-Breaker (Lexicographical Record ID comparison)
    const localId = String(localRecord.id || "");
    const remoteId = String(remoteRecord.id || "");
    return localId.localeCompare(remoteId) >= 0 ? localRecord : remoteRecord;
  }
};
