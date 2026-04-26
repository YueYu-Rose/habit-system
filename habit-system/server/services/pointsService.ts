import type { Database } from "better-sqlite3";

export type LedgerSourceType = "auto" | "manual" | "external_todo" | "settlement" | "redeem";

export function getBalances(db: Database): { available: number; lifetime: number } {
  const row = db.prepare(`SELECT available_points, lifetime_points FROM points_state WHERE id = 1`).get() as {
    available_points: number;
    lifetime_points: number;
  };
  return { available: row.available_points, lifetime: row.lifetime_points };
}

function assertMultipleOf5(n: number, allowRedeem = false): void {
  if (!allowRedeem && n % 5 !== 0) throw new Error("分值须为 5 的倍数");
}

/**
 * 写入或替换流水并同步余额（按差额调整）。
 */
export function replaceOrInsertLedger(
  db: Database,
  params: {
    habitDate: string;
    sourceKey: string;
    amount: number;
    title: string;
    sourceType: LedgerSourceType;
    meta?: Record<string, unknown>;
    redeemOnly?: boolean;
  }
): void {
  const { habitDate, sourceKey, amount, title, sourceType, meta, redeemOnly } = params;
  assertMultipleOf5(Math.abs(amount), !!redeemOnly);

  const now = new Date().toISOString();
  const deltaAv = amount;
  const deltaLife = redeemOnly ? 0 : amount;

  const old = db
    .prepare(`SELECT amount, delta_available, delta_lifetime FROM point_ledger WHERE habit_date = ? AND source_key = ?`)
    .get(habitDate, sourceKey) as { amount: number; delta_available: number; delta_lifetime: number } | undefined;

  const tx = db.transaction(() => {
    if (old) {
      db.prepare(`DELETE FROM point_ledger WHERE habit_date = ? AND source_key = ?`).run(habitDate, sourceKey);
      db.prepare(
        `UPDATE points_state SET available_points = available_points - ?, lifetime_points = lifetime_points - ?, updated_at = ? WHERE id = 1`
      ).run(old.delta_available, old.delta_lifetime, now);
    }

    db.prepare(
      `
      INSERT INTO point_ledger (
        habit_date, created_at, amount, delta_available, delta_lifetime,
        source_type, source_key, title, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      habitDate,
      now,
      amount,
      deltaAv,
      deltaLife,
      sourceType,
      sourceKey,
      title,
      meta ? JSON.stringify(meta) : null
    );

    if (redeemOnly) {
      db.prepare(`UPDATE points_state SET available_points = available_points + ?, updated_at = ? WHERE id = 1`).run(
        deltaAv,
        now
      );
    } else {
      db.prepare(
        `UPDATE points_state SET available_points = available_points + ?, lifetime_points = lifetime_points + ?, updated_at = ? WHERE id = 1`
      ).run(deltaAv, deltaLife, now);
    }
  });
  tx();
}

/** 删除一条流水并回滚余额 */
export function deleteLedgerByKey(db: Database, habitDate: string, sourceKey: string): void {
  const row = db
    .prepare(`SELECT delta_available, delta_lifetime FROM point_ledger WHERE habit_date = ? AND source_key = ?`)
    .get(habitDate, sourceKey) as { delta_available: number; delta_lifetime: number } | undefined;
  if (!row) return;
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM point_ledger WHERE habit_date = ? AND source_key = ?`).run(habitDate, sourceKey);
  db.prepare(
    `UPDATE points_state SET available_points = available_points - ?, lifetime_points = lifetime_points - ?, updated_at = ? WHERE id = 1`
  ).run(row.delta_available, row.delta_lifetime, now);
}
