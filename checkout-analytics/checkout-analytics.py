"""
Checkout outcome probability analysis.

Uses raw weights from @henrylabs-interview/payments SDK and our server's
retryWithBackoff (max 3 attempts) + waitForWebhook (deferred resolution)
to compute end-to-end probabilities for each price range.
"""

# =============================================================================
# SDK raw weights — checkout.create() / determineResponseCase()
# =============================================================================

def create_weights(amount: float, same_records: int) -> dict[str, float]:
    """Exact replica of SDK's determineResponseCase() weight calculation."""
    s = same_records

    immediate = 65 - s * 10
    deferred  = 20 + s * 5
    retry     = 10 + s * 5
    fraud     = 0  + s * 15

    if amount > 1_000:
        deferred += s * 5 + 10
        retry    += s * 5 + 10

    if amount > 5_000:
        immediate -= s * 5 + 15
        retry     += s * 5 + 30
        fraud     += s * 10

    if amount > 10_000:
        fraud += s * 30

    immediate = max(0, immediate)
    deferred  = max(0, deferred)
    retry     = max(0, retry)
    fraud     = max(0, fraud)

    total = immediate + deferred + retry + fraud

    return {
        "immediate": immediate / total,
        "deferred":  deferred  / total,
        "retry":     retry     / total,
        "fraud":     fraud     / total,
    }


# =============================================================================
# SDK raw weights — checkout.confirm() / processConfirmDecision()
# =============================================================================

CONFIRM_WEIGHTS = {
    "immediate": 0.35,
    "deferred":  0.30,
    "retry":     0.30,
    "fraud":     0.05,
}


# =============================================================================
# Deferred webhook resolution probabilities
# SDK uses two sequential Math.random() calls:
#   if random() > 0.2  → success          (80%)
#   else if random() > 0.05 → retry       (20% * 95% = 19%)
#   else → fraud                           (20% * 5%  = 1%)
# =============================================================================

DEFERRED_SUCCESS = 0.80
DEFERRED_RETRY   = 0.20 * 0.95  # 0.19
DEFERRED_FRAUD   = 0.20 * 0.05  # 0.01


# =============================================================================
# Effective single-attempt probabilities (SDK call + webhook resolution)
# =============================================================================

def effective_attempt(weights: dict[str, float]) -> dict[str, float]:
    """Combine raw SDK weights with deferred webhook resolution."""
    return {
        "success": weights["immediate"] + weights["deferred"] * DEFERRED_SUCCESS,
        "retry":   weights["retry"]     + weights["deferred"] * DEFERRED_RETRY,
        "fraud":   weights["fraud"]     + weights["deferred"] * DEFERRED_FRAUD,
    }


# =============================================================================
# Multi-attempt outcome (our server retries up to 3 times on 503-retry)
#
# For create: sameRecords increments each attempt, so weights shift.
# For confirm: weights are fixed across attempts.
# =============================================================================

def final_outcome_create(amount: float, max_retries: int = 3) -> dict[str, float]:
    """Probability of each final outcome after up to max_retries attempts."""
    p_success = 0.0
    p_fraud   = 0.0
    p_still_retrying = 1.0

    for attempt in range(max_retries):
        w = create_weights(amount, same_records=attempt)
        eff = effective_attempt(w)

        p_success += p_still_retrying * eff["success"]
        p_fraud   += p_still_retrying * eff["fraud"]
        p_still_retrying *= eff["retry"]

    # After max retries exhausted, remaining probability is "retry exhausted"
    return {
        "success":         p_success,
        "fraud":           p_fraud,
        "retry_exhausted": p_still_retrying,
    }


def final_outcome_confirm(max_retries: int = 3) -> dict[str, float]:
    """Confirm weights are fixed (no sameRecords adjustment)."""
    eff = effective_attempt(CONFIRM_WEIGHTS)

    p_success = 0.0
    p_fraud   = 0.0
    p_still_retrying = 1.0

    for _ in range(max_retries):
        p_success += p_still_retrying * eff["success"]
        p_fraud   += p_still_retrying * eff["fraud"]
        p_still_retrying *= eff["retry"]

    return {
        "success":         p_success,
        "fraud":           p_fraud,
        "retry_exhausted": p_still_retrying,
    }


# =============================================================================
# End-to-end: create must succeed, THEN confirm must succeed
# =============================================================================

def end_to_end(amount: float) -> dict[str, float]:
    c = final_outcome_create(amount)
    k = final_outcome_confirm()

    e2e_success         = c["success"] * k["success"]
    e2e_create_fraud    = c["fraud"]
    e2e_confirm_fraud   = c["success"] * k["fraud"]
    e2e_create_exhaust  = c["retry_exhausted"]
    e2e_confirm_exhaust = c["success"] * k["retry_exhausted"]

    return {
        "success":              e2e_success,
        "create_fraud":         e2e_create_fraud,
        "confirm_fraud":        e2e_confirm_fraud,
        "create_retry_exhaust": e2e_create_exhaust,
        "confirm_retry_exhaust": e2e_confirm_exhaust,
    }


# =============================================================================
# Pretty-print tables
# =============================================================================

def pct(v: float) -> str:
    return f"{v * 100:6.2f}%"


def print_divider(width: int = 80):
    print("=" * width)


PRICE_POINTS = [100, 500, 2_000, 5_000, 7_500, 10_000, 15_000]


def table_1_raw_create_weights():
    print_divider()
    print("TABLE 1: Raw SDK Weights — checkout.create() (first attempt, sameRecords=0)")
    print_divider()
    print(f"{'Amount':>10} | {'Immediate':>10} | {'Deferred':>10} | {'Retry':>10} | {'Fraud':>10}")
    print("-" * 62)
    for amt in PRICE_POINTS:
        w = create_weights(amt, same_records=0)
        print(f"${amt:>8,} | {pct(w['immediate']):>10} | {pct(w['deferred']):>10} | {pct(w['retry']):>10} | {pct(w['fraud']):>10}")
    print()


def table_2_create_weight_degradation():
    print_divider()
    print("TABLE 2: Create Weight Degradation Over Retries (amount=$100 vs $7,500)")
    print_divider()

    for amt in [100, 7_500]:
        print(f"\n  Amount = ${amt:,}")
        print(f"  {'Attempt':>8} | {'Immediate':>10} | {'Deferred':>10} | {'Retry':>10} | {'Fraud':>10}")
        print("  " + "-" * 60)
        for s in range(4):
            w = create_weights(amt, same_records=s)
            print(f"  {s:>8} | {pct(w['immediate']):>10} | {pct(w['deferred']):>10} | {pct(w['retry']):>10} | {pct(w['fraud']):>10}")
    print()


def table_3_effective_single_attempt():
    print_divider()
    print("TABLE 3: Effective Single-Attempt Probabilities (SDK + Webhook Resolution)")
    print_divider()
    print(f"{'Amount':>10} | {'Success':>10} | {'Retry':>10} | {'Fraud':>10}")
    print("-" * 48)
    for amt in PRICE_POINTS:
        w = create_weights(amt, same_records=0)
        eff = effective_attempt(w)
        print(f"${amt:>8,} | {pct(eff['success']):>10} | {pct(eff['retry']):>10} | {pct(eff['fraud']):>10}")

    print(f"\n  {'Confirm':>9} | {pct(effective_attempt(CONFIRM_WEIGHTS)['success']):>10} | "
          f"{pct(effective_attempt(CONFIRM_WEIGHTS)['retry']):>10} | "
          f"{pct(effective_attempt(CONFIRM_WEIGHTS)['fraud']):>10}   (fixed, all amounts)")
    print()


def table_4_final_after_retries():
    print_divider()
    print("TABLE 4: Final Create Outcome After Up To 3 Retries")
    print_divider()
    print(f"{'Amount':>10} | {'Success':>10} | {'Fraud':>10} | {'Exhausted':>10}")
    print("-" * 48)
    for amt in PRICE_POINTS:
        f = final_outcome_create(amt)
        print(f"${amt:>8,} | {pct(f['success']):>10} | {pct(f['fraud']):>10} | {pct(f['retry_exhausted']):>10}")

    print(f"\n  Confirm (fixed):")
    fk = final_outcome_confirm()
    print(f"  {'All':>9} | {pct(fk['success']):>10} | {pct(fk['fraud']):>10} | {pct(fk['retry_exhausted']):>10}")
    print()


def table_5_end_to_end():
    print_divider()
    print("TABLE 5: End-to-End Outcome (Create + Confirm)")
    print_divider()
    print(f"{'Amount':>10} | {'Success':>10} | {'Create':>10} | {'Confirm':>10} | {'Create':>10} | {'Confirm':>10}")
    print(f"{'':>10} | {'':>10} | {'Fraud':>10} | {'Fraud':>10} | {'Exhaust':>10} | {'Exhaust':>10}")
    print("-" * 72)
    for amt in PRICE_POINTS:
        e = end_to_end(amt)
        print(
            f"${amt:>8,} | {pct(e['success']):>10} | {pct(e['create_fraud']):>10} | "
            f"{pct(e['confirm_fraud']):>10} | {pct(e['create_retry_exhaust']):>10} | "
            f"{pct(e['confirm_retry_exhaust']):>10}"
        )
    print()


if __name__ == "__main__":
    print()
    table_1_raw_create_weights()
    table_2_create_weight_degradation()
    table_3_effective_single_attempt()
    table_4_final_after_retries()
    table_5_end_to_end()
